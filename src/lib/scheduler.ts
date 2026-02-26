/**
 * PROCESSING SCHEDULER
 *
 * Manages the complete pipeline:
 * queued → processing_ocr → ocr_complete → processing_resize → resize_complete → processing_ai → complete
 */

import { ItemService, Item } from './db/items';
import { db } from './db';
import { resizeImage } from './processing/resize';
import { performCloudVisionOCR } from './ocr/cloud-vision';
import { runConductor } from './ai/conductor';
import { runPerplexityResearcher } from './ai/perplexity-researcher';
import { extractValuation } from './ai/valuator';

const POLLING_INTERVAL_MS = 2000;
const MAX_CONCURRENT_JOBS = 1;

let isRunning = false;
let activeJobs = 0;
let interval: NodeJS.Timeout | null = null;
let watchdogInterval: NodeJS.Timeout | null = null;

export async function startProcessingLoop() {
  if (isRunning) return;
  isRunning = true;

  console.log('[Scheduler] Starting processing loop...');

  // Reset any stale locks from previous crash
  ItemService.resetLocks();

  // Start Runtime Watchdog (checks every 1 minute)
  watchdogInterval = setInterval(() => {
    ItemService.resetStaleLocks(5); // Reset locks older than 5 minutes
  }, 60 * 1000);

  // Start polling loop
  processingLoop();
}

export function stopProcessingLoop() {
  isRunning = false;
  if (interval) clearTimeout(interval);
  if (watchdogInterval) clearInterval(watchdogInterval);
  console.log('[Scheduler] Processing loop stopped.');
}

async function processingLoop() {
  if (!isRunning) return;

  try {
    if (activeJobs < MAX_CONCURRENT_JOBS) {
      const item = ItemService.lockNext();

      if (item) {
        activeJobs++;
        processItem(item).finally(() => {
          activeJobs--;
        });
      }
    }
  } catch (err: any) {
    console.error('[Scheduler] Loop error:', err.message);
  }

  // Schedule next iteration
  interval = setTimeout(processingLoop, POLLING_INTERVAL_MS);
}

async function processItem(item: Item) {
  try {
    console.log(`[Scheduler] Processing ${item.id} (status: ${item.status})`);

    // Router: dispatch to appropriate handler based on status.
    // Each stage runs its work to completion before returning,
    // so the lock is held through the full stage (not just the transition).

    if (item.status === 'queued' || item.status === 'processing_ocr' || item.status === 'ocr_pending_retry') {
      // Signal OCR in progress
      db.prepare(`UPDATE items SET status = 'processing_ocr', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);

      try {
        const ocrResult = await performCloudVisionOCR(item.originalImagePath!);

        const webEntitiesText = ocrResult.webEntities && ocrResult.webEntities.length > 0
          ? '\n\n--- Web Entities (Knowledge Graph) ---\n' + ocrResult.webEntities.map(e => `- ${e.description} (${(e.score * 100).toFixed(1)}%)`).join('\n')
          : '';

        ItemService.updateMetadata(item.id, {
          rawOcr: ocrResult.text + webEntitiesText,
          confidence: ocrResult.confidence,
          ocrDurationMs: ocrResult.duration_ms
        });

        db.prepare(`UPDATE items SET status = 'ocr_complete', statusUpdatedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), item.id);

        console.log(`[Scheduler] ${item.id}: OCR complete (confidence: ${(ocrResult.confidence * 100).toFixed(1)}%)`);

      } catch (err: any) {
        if (err.message.includes('QUOTA_EXCEEDED')) {
          console.warn(`[Scheduler] ${item.id}: GCV quota exceeded, retrying later`);
          db.prepare(`UPDATE items SET status = 'ocr_pending_retry', processingLock = 0, watchdogLockedAt = NULL, statusUpdatedAt = ? WHERE id = ?`)
            .run(new Date().toISOString(), item.id);
        } else {
          console.error(`[Scheduler] ${item.id}: OCR failed -`, err.message);
          db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
            .run(err.message, new Date().toISOString(), item.id);
        }
      }
      return;
    }

    if (item.status === 'ocr_complete' || item.status === 'processing_resize') {
      // Signal resize in progress
      db.prepare(`UPDATE items SET status = 'processing_resize', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);

      try {
        const { thumbnailPath, resizedPath, durationMs } = await resizeImage(item.originalImagePath!, item.id);

        ItemService.updateMetadata(item.id, {
          thumbnailPath,
          resizedImagePath: resizedPath,
          resizeDurationMs: durationMs
        });

        db.prepare(`UPDATE items SET status = 'resize_complete', statusUpdatedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), item.id);

        console.log(`[Scheduler] ${item.id}: resize complete`);
      } catch (err: any) {
        console.error(`[Scheduler] ${item.id}: resize failed -`, err.message);
        db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
          .run(err.message, new Date().toISOString(), item.id);
      }
      return;
    }

    if (item.status === 'resize_complete' || item.status === 'processing_ai') {
      // Signal AI in progress
      db.prepare(`UPDATE items SET status = 'processing_ai', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);

      try {
        const now = () => new Date().toISOString();

        // Load image for multimodal Conductor
        const imageBuffer = fs.readFileSync(item.originalImagePath!);
        const imageBase64 = imageBuffer.toString('base64');

        // Step 1: Conductor — categorize the item
        const conductorResult = await runConductor(item.rawOcr || '', imageBase64);
        console.log(`[Scheduler] ${item.id}: Conductor → "${conductorResult.category}" (${conductorResult.confidence_score})`);

        // ---> IMMEDIATE UPDATE FOR UI FEEDBACK <---
        ItemService.updateMetadata(item.id, {
          title: `[Identified] ${conductorResult.category.replace(/_/g, ' ')}`,
          category: conductorResult.category,
          confidence: conductorResult.confidence_score,
        });
        // Also update status to show progress, but keep it in the AI stage
        db.prepare(`UPDATE items SET statusUpdatedAt = ? WHERE id = ?`).run(now(), item.id);

        // Step 2: Perplexity — live web search for market data, sold prices, historical context
        const researchResult = await runPerplexityResearcher(
          conductorResult.category,
          item.rawOcr || '',
          conductorResult.basic_id
        );
        console.log(`[Scheduler] ${item.id}: Perplexity research complete (${researchResult.citations.length} citations)`);

        // Step 3: Valuator (Claude 4.6) — synthesize everything into a formal ID, archival notes, and sale valuation
        const valuationResult = await extractValuation(
          conductorResult.basic_id,
          conductorResult.category,
          item.rawOcr || '',
          researchResult.notes,
        );
        
        if (!valuationResult) throw new Error("Valuation step returned null");
        console.log(`[Scheduler] ${item.id}: Valuation → $${valuationResult.estimated_value_point ?? '?'} (${valuationResult.value_confidence} confidence)`);

        // Step 4: Build analysis history entry
        let analysisHistory: any[] = [];
        if (item.analysis_history) {
          try { analysisHistory = JSON.parse(item.analysis_history); } catch {}
        }
        analysisHistory.push({
          timestamp: now(),
          category: conductorResult.category,
          conductor_confidence: conductorResult.confidence_score,
          archival_data: {
            formal_title: valuationResult.title,
            historical_context: valuationResult.historical_context,
            collector_significance: valuationResult.collector_significance,
            identified_names: valuationResult.identified_names,
            condition_issues: valuationResult.visible_condition_issues,
            potential_value_factors: valuationResult.potential_value_factors,
          },
          perplexity_citations: researchResult.citations,
          valuation: {
            point: valuationResult.estimated_value_point,
            low: valuationResult.estimated_value_low,
            high: valuationResult.estimated_value_high,
            confidence: valuationResult.value_confidence,
            reasoning: valuationResult.value_reasoning,
          },
          raw_data: {
            conductor: conductorResult.raw_response,
            researcher: researchResult.raw_response,
          },
        });

        // Step 5: Persist all fields directly
        db.prepare(`
          UPDATE items SET
            title = ?,
            identifiedNames = ?,
            historicalContext = ?,
            collectorSignificance = ?,
            category = ?,
            analysis_history = ?,
            status = 'complete',
            statusUpdatedAt = ?
          WHERE id = ?
        `).run(
          valuationResult.title,
          JSON.stringify(valuationResult.identified_names),
          valuationResult.historical_context,
          valuationResult.collector_significance,
          conductorResult.category,
          JSON.stringify(analysisHistory),
          now(),
          item.id,
        );

        // Step 6: Save structured valuation fields
        ItemService.updateValuation(item.id, {
          estimated_value_low: valuationResult.estimated_value_low,
          estimated_value_high: valuationResult.estimated_value_high,
          estimated_value_point: valuationResult.estimated_value_point,
          value_confidence: valuationResult.value_confidence,
          is_high_value: valuationResult.is_high_value,
          ebay_keywords: valuationResult.ebay_keywords,
        });

        console.log(`[Scheduler] ${item.id}: Pipeline complete — "${valuationResult.title}" → $${valuationResult.estimated_value_point ?? '?'}`);

      } catch (err: any) {
        console.error(`[Scheduler] ${item.id}: AI enrichment failed -`, err.message);
        db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
          .run(err.message, new Date().toISOString(), item.id);
      }
      return;
    }

    // Release lock for completed items
    if (item.status === 'complete' || item.status === 'error') {
      db.prepare(`UPDATE items SET processingLock = 0, watchdogLockedAt = NULL WHERE id = ?`)
        .run(item.id);
      return;
    }

  } catch (err: any) {
    console.error(`[Scheduler] ${item.id}: Error -`, err.message);
    db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
      .run(err.message, new Date().toISOString(), item.id);
  }
}
