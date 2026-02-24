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
import { runExpert } from './ai/expert';

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

    // Router: dispatch to appropriate handler based on status
    if (item.status === 'queued') {
      // Move to OCR stage
      db.prepare(`UPDATE items SET status = 'processing_ocr', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);
      return;
    }

    if (item.status === 'processing_ocr') {
      try {
        const ocrResult = await performCloudVisionOCR(item.originalImagePath!);

        ItemService.updateMetadata(item.id, {
          rawOcr: ocrResult.text,
          confidence: ocrResult.confidence,
          ocrDurationMs: ocrResult.duration_ms
        });

        db.prepare(`UPDATE items SET status = 'ocr_complete', statusUpdatedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), item.id);

        console.log(`[Scheduler] ${item.id}: OCR complete (confidence: ${(ocrResult.confidence * 100).toFixed(1)}%)`);

      } catch (err: any) {
        // Handle specific errors
        if (err.message.includes('QUOTA_EXCEEDED')) {
          console.warn(`[Scheduler] ${item.id}: GCV quota exceeded, retrying later`);
          db.prepare(`UPDATE items SET status = 'ocr_pending_retry', statusUpdatedAt = ? WHERE id = ?`)
            .run(new Date().toISOString(), item.id);
        } else {
          console.error(`[Scheduler] ${item.id}: OCR failed -`, err.message);
          db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
            .run(err.message, new Date().toISOString(), item.id);
        }
      }
      return;
    }

    // Handle retry state
    if (item.status === 'ocr_pending_retry') {
      console.log(`[Scheduler] ${item.id}: retrying OCR...`);
      // Move back to processing_ocr to retry
      db.prepare(`UPDATE items SET status = 'processing_ocr', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);
      return;
    }

    if (item.status === 'ocr_complete') {
      // Move to resize stage
      db.prepare(`UPDATE items SET status = 'processing_resize', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);
      return;
    }

    if (item.status === 'processing_resize') {
      try {
        const { thumbnailPath, resizedPath, durationMs } = await resizeImage(item.originalImagePath!, item.id);

        // Update DB
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

    if (item.status === 'resize_complete') {
      // Move to AI stage
      db.prepare(`UPDATE items SET status = 'processing_ai', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);
      return;
    }

    if (item.status === 'processing_ai') {
      try {
        // Step 1: Run Conductor to categorize
        const conductorResult = await runConductor(item.rawOcr || '');
        console.log(`[Scheduler] ${item.id}: Conductor categorized as "${conductorResult.category}" (confidence: ${conductorResult.confidence_score})`);

        // Step 2: Run Expert for detailed extraction
        const expertResult = await runExpert(conductorResult.category, item.rawOcr || '');

        // Step 3: Build analysis history entry
        const analysisEntry = {
          timestamp: new Date().toISOString(),
          category: conductorResult.category,
          conductor_confidence: conductorResult.confidence_score,
          expert_extracted_title: expertResult.title,
          extracted_fields: {
            identified_names: expertResult.identified_names,
            historical_context: expertResult.historical_context,
            collector_significance: expertResult.collector_significance,
            estimated_value_signals: expertResult.estimated_value_signals,
            condition_issues: expertResult.visible_condition_issues,
            ebay_keywords: expertResult.ebay_search_keywords,
          },
        };

        // Parse existing analysis_history
        let analysisHistory: any[] = [];
        if (item.analysis_history) {
          try {
            analysisHistory = JSON.parse(item.analysis_history);
          } catch (err) {
            console.warn(`[Scheduler] ${item.id}: Could not parse existing analysis_history`);
          }
        }
        analysisHistory.push(analysisEntry);

        // Step 4: Update DB
        ItemService.updateMetadata(item.id, {
          title: expertResult.title,
          identifiedNames: JSON.stringify(expertResult.identified_names),
          historicalContext: expertResult.historical_context,
          collectorSignificance: expertResult.collector_significance,
          analysis_history: JSON.stringify(analysisHistory),
        });

        db.prepare(`UPDATE items SET status = 'complete', statusUpdatedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), item.id);

        console.log(`[Scheduler] ${item.id}: Enrichment complete - "${expertResult.title}"`);

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
