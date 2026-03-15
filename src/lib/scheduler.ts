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
import { runResearcher } from './ai/researcher';

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
    // If we have a loop error, wait a bit longer to avoid spamming
    await new Promise(resolve => setTimeout(resolve, 10000));
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
      ItemService.updateStatus(item.id, 'processing_ocr');
      return;
    }

    if (item.status === 'processing_ocr') {
      try {
        const ocrResult = await performCloudVisionOCR(item.originalImagePath!);

        const webEntitiesText = ocrResult.webEntities && ocrResult.webEntities.length > 0 
          ? '\n\n--- Web Entities (Knowledge Graph) ---\n' + ocrResult.webEntities.map(e => `- ${e.description} (${(e.score * 100).toFixed(1)}%)`).join('\n')
          : '';

        ItemService.updateStatus(item.id, 'ocr_complete', {
          rawOcr: ocrResult.text + webEntitiesText,
          confidence: ocrResult.confidence,
          ocrDurationMs: ocrResult.duration_ms
        });

        console.log(`[Scheduler] ${item.id}: OCR complete (confidence: ${(ocrResult.confidence * 100).toFixed(1)}%)`);

      } catch (err: any) {
        // Handle specific errors
        if (err.message.includes('QUOTA_EXCEEDED')) {
          console.warn(`[Scheduler] ${item.id}: GCV quota exceeded, retrying later`);
          ItemService.updateStatus(item.id, 'ocr_pending_retry');
        } else {
          console.error(`[Scheduler] ${item.id}: OCR failed -`, err.message);
          ItemService.fail(item.id, err.message);
        }
      }
      return;
    }

    // Handle retry state
    if (item.status === 'ocr_pending_retry') {
      console.log(`[Scheduler] ${item.id}: retrying OCR...`);
      // Move back to processing_ocr to retry
      ItemService.updateStatus(item.id, 'processing_ocr');
      return;
    }

    if (item.status === 'ocr_complete') {
      // Move to resize stage
      ItemService.updateStatus(item.id, 'processing_resize');
      return;
    }

    if (item.status === 'processing_resize') {
      try {
        const { thumbnailPath, resizedPath, durationMs } = await resizeImage(item.originalImagePath!, item.id);

        ItemService.updateStatus(item.id, 'resize_complete', {
          thumbnailPath,
          resizedImagePath: resizedPath,
          resizeDurationMs: durationMs
        });

        console.log(`[Scheduler] ${item.id}: resize complete`);
      } catch (err: any) {
        console.error(`[Scheduler] ${item.id}: resize failed -`, err.message);
        ItemService.fail(item.id, err.message);
      }
      return;
    }

    if (item.status === 'resize_complete') {
      // Move to AI stage
      ItemService.updateStatus(item.id, 'processing_ai');
      return;
    }

    if (item.status === 'processing_ai') {
      try {
        // Step 1: Run Conductor to categorize
        const conductorResult = await runConductor(item.rawOcr || '');
        console.log(`[Scheduler] ${item.id}: Conductor categorized as "${conductorResult.category}" (confidence: ${conductorResult.confidence_score})`);

        // Step 2: Run Researcher (Gemini/Perplexity) for grounding
        const researcherResult = await runResearcher(conductorResult.category, item.rawOcr || '');
        console.log(`[Scheduler] ${item.id}: Researcher completed grounding via ${researcherResult.provider}`);

        // Step 3: Run Expert (Sonnet) for detailed extraction, passing researcher data
        const expertResult = await runExpert(conductorResult.category, item.rawOcr || '', researcherResult.notes);

        // Step 4: Build analysis history entry
        const analysisEntry = {
          timestamp: new Date().toISOString(),
          category: conductorResult.category,
          conductor_confidence: conductorResult.confidence_score,
          expert_extracted_title: expertResult.identification,
          research_provider: researcherResult.provider,
          extracted_fields: {
            historical_context: expertResult.historical_context,
            collector_significance: expertResult.collector_significance,
            estimated_value: expertResult.estimated_value,
            ebay_keywords: expertResult.ebay_search_keywords,
          },
          raw_data: {
            conductor: conductorResult.raw_response,
            researcher: researcherResult.raw_response,
            expert: expertResult.raw_response
          }
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

        // Step 5: Update DB and UNLOCK
        ItemService.unlock(item.id, 'complete', {
          title: expertResult.identification,
          historicalContext: expertResult.historical_context,
          collectorSignificance: expertResult.collector_significance,
          analysis_history: JSON.stringify(analysisHistory),
          aiRawResponse: JSON.stringify({ 
            expert: expertResult.raw_response, 
            researcher: researcherResult.raw_response,
            conductor: conductorResult.raw_response 
          })
        });

        console.log(`[Scheduler] ${item.id}: Enrichment complete - "${expertResult.identification}"`);

      } catch (err: any) {
        console.error(`[Scheduler] ${item.id}: AI enrichment failed -`, err.message);
        ItemService.fail(item.id, err.message);
      }
      return;
    }

    // Release lock for completed items (if they somehow get here)
    if (item.status === 'complete' || item.status === 'error') {
      db.prepare(`UPDATE items SET processingLock = 0, watchdogLockedAt = NULL WHERE id = ?`)
        .run(item.id);
      return;
    }

  } catch (err: any) {
    console.error(`[Scheduler Fatal] ${item.id}: Error -`, err.message);
    if (err.stack) console.error(err.stack);
    ItemService.fail(item.id, err.message);
  }
}
