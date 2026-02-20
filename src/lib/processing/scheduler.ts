import path from 'path';
import fs from 'fs';
import { ItemService } from '../db/items';
import { ImageProcessor } from './image-processor';
import { analyzeImage } from '../ai';
import { performOCR } from '../ocr';

const LOG_FILE = path.join(process.cwd(), 'data', 'logs', 'worker.log');

// Ensure log dir exists
if (!fs.existsSync(path.dirname(LOG_FILE))) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

// Worker pool could be implemented here, but we'll start with a single active worker for simplicity
// and to avoid locking the main thread.

export async function processNextItem() {
  const item = ItemService.lockNext();
  
  if (!item) {
    return false; // No work found
  }

  log(`Picked up item ${item.id} [${item.status}]`);

  try {
    switch (item.status) {
      case 'queued':
        // Move to OCR
        ItemService.updateStatus(item.id, 'processing_ocr');
        break;

      case 'processing_ocr':
        log(`Running OCR for ${item.id}`);
        if (!item.originalImagePath) {
           ItemService.fail(item.id, 'Missing originalImagePath for OCR');
           break;
        }

        try {
            const ocrResult = await performOCR(item.originalImagePath); // Language defaults to eng
            
             // OCR Complete: UNLOCK it so it can be picked up by next loop? 
             // Actually, Scheduler loop picks it up if we just set status to ocr_complete?
             // lockNext picks up 'ocr_complete'. So we should UNLOCK it here to let the loop re-lock it for next stage.
             ItemService.unlock(item.id, 'ocr_complete', { 
                rawOcr: ocrResult.text, 
                confidence: ocrResult.confidence 
             });
        } catch (ocrErr: any) {
            log(`OCR Failed: ${ocrErr.message}`);
            ItemService.fail(item.id, `OCR Failed: ${ocrErr.message}`);
        }
        break;

      case 'ocr_complete':
        // Ready for resize
        ItemService.updateStatus(item.id, 'processing_resize');
        break;
        
      case 'processing_resize':
        // Run Image Processing (Sharp)
        log(`Resizing for ${item.id}`);
        if (!item.originalImagePath) {
           ItemService.fail(item.id, 'Missing originalImagePath for Resize');
           break;
        }

        const resizeResult = await ImageProcessor.process(item.id, item.originalImagePath);
        
        ItemService.unlock(item.id, 'resize_complete', { 
          resizedImagePath: resizeResult.resizedPath, 
          thumbnailPath: resizeResult.thumbnailPath,
          resizeDurationMs: resizeResult.resizeDurationMs
        });
        break;

      case 'resize_complete':
        // Ready for AI
        ItemService.updateStatus(item.id, 'processing_ai');
        break;

      case 'processing_ai':
        // Run AI Analysis (Gemini)
        log(`AI Analysis for ${item.id}`);
        if (!process.env.GEMINI_API_KEY) {
           log(`[WARN] Skipping AI: GEMINI_API_KEY not set.`);
           log(`[WARN] Skipping AI: GEMINI_API_KEY not set.`);
           ItemService.unlock(item.id, 'complete', { errorMessage: 'No API Key' }); // Just complete it to avoid loop
           break;
        }

        const aiResult = await analyzeImage(item.resizedImagePath || item.originalImagePath || '', item.rawOcr || '');
        
        log(`AI Success for ${item.id}. Title: ${aiResult.title}`);
        ItemService.unlock(item.id, 'complete', {
          title: aiResult.title,
          cleanedTranscription: aiResult.cleanedTranscription,
          identifiedNames: JSON.stringify(aiResult.identifiedNames),
          historicalContext: aiResult.historicalContext,
          collectorSignificance: aiResult.collectorSignificance,
          confidence: aiResult.confidence,
          // aiRawResponse: aiResult.rawResponse,
          // aiDurationMs: aiResult.durationMs
        });
        break;

      default:
        log(`Unknown status ${item.status} for item ${item.id}`);
        ItemService.unlock(item.id, 'error', { errorMessage: 'Unknown State' }); // Release lock on unknown
        break;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`[ERROR] Item ${item.id}: ${errorMsg}`);
    ItemService.fail(item.id, errorMsg);
  }

  return true;
}

// function runOCR(item: any): Promise<void> { ... } removed in favor of src/lib/ocr/index.ts

/**
 * Starts the polling loop. 
 * NOTE: In a serverless/Next.js environment, this is tricky.
 * Best used in a standalone script or instrumentation hook.
 */
let isRunning = false;
export function startProcessingLoop(intervalMs = 5000) {
    if (isRunning) return;
    isRunning = true;
    console.log('[Scheduler] Starting processing loop...');

    const loop = async () => {
        try {
            const didWork = await processNextItem();
            // If we did work, check immediately for more. If not, wait.
            setTimeout(loop, didWork ? 100 : intervalMs);
        } catch (e) {
            console.error('[Scheduler] Loop error:', e);
            setTimeout(loop, intervalMs);
        }
    };
    
    loop();
}
