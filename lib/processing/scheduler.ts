import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { lockNextPendingItem, updateItemStatus, failItem, releaseLock } from '../db/items';
import { processImage } from './image-processor';
import { analyzeItem } from '../ai/gemini-client';

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
  const item = lockNextPendingItem();
  
  if (!item) {
    return false; // No work found
  }

  log(`Picked up item ${item.id} [${item.status}]`);

  try {
    switch (item.status) {
      case 'queued':
        // Move to OCR
        updateItemStatus(item.id, 'processing_ocr');
        break;

      case 'processing_ocr':
        log(`Running OCR for ${item.id}`);
        await runOCR(item);
        break;

      case 'ocr_complete':
        // Ready for resize
        updateItemStatus(item.id, 'processing_resize');
        break;
        
      case 'processing_resize':
        // Run Image Processing (Sharp)
        log(`Resizing for ${item.id}`);
        const resizeResult = await processImage(item.originalImagePath, item.originalFilename);
        
        updateItemStatus(item.id, 'resize_complete', { 
          resizedImagePath: resizeResult.resizedPath, 
          thumbnailPath: resizeResult.thumbnailPath,
          resizeDurationMs: resizeResult.durationMs
        });
        break;

      case 'resize_complete':
        // Ready for AI
        updateItemStatus(item.id, 'processing_ai');
        break;

      case 'processing_ai':
        // Run AI Analysis (Gemini)
        log(`AI Analysis for ${item.id}`);
        if (!process.env.GEMINI_API_KEY) {
           log(`[WARN] Skipping AI: GEMINI_API_KEY not set.`);
           updateItemStatus(item.id, 'complete', { aiRawResponse: '{"error": "No API Key"}' });
           break;
        }

        const aiResult = await analyzeItem(item.rawOcr || '');
        
        log(`AI Success for ${item.id}. Title: ${aiResult.parsedData.title}`);
        updateItemStatus(item.id, 'complete', {
          title: aiResult.parsedData.title,
          cleanedTranscription: aiResult.parsedData.cleanedTranscription,
          identifiedNames: JSON.stringify(aiResult.parsedData.identifiedNames),
          historicalContext: aiResult.parsedData.historicalContext,
          collectorSignificance: aiResult.parsedData.collectorSignificance,
          confidence: aiResult.parsedData.confidence,
          aiRawResponse: aiResult.rawResponse,
          aiDurationMs: aiResult.durationMs
        });
        break;

      default:
        log(`Unknown status ${item.status} for item ${item.id}`);
        releaseLock(item.id);
        break;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`[ERROR] Item ${item.id}: ${errorMsg}`);
    failItem(item.id, errorMsg);
  }

  return true;
}

function runOCR(item: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(process.cwd(), 'workers', 'ocr.worker.ts');
    
    // In production (compiled), we might need to point to the JS version or use ts-node register
    // Since we are in dev with tsx, this works.
    
    const worker = new Worker(workerPath, {
      workerData: { filePath: item.originalImagePath }
    });

    worker.on('message', (result) => {
      const { text, confidence } = result;
      updateItemStatus(item.id, 'ocr_complete', { 
        rawOcr: text, 
        confidence: confidence 
      });
      resolve();
    });

    worker.on('error', (err) => {
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`OCR Worker stopped with exit code ${code}`));
      }
    });
  });
}

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
