/**
 * OCR WORKER THREAD (HARDENED)
 * 
 * Runs Tesseract.js in a separate thread to prevent blocking the main event loop.
 * 
 * INPUT: { filePath: string, language?: string }
 * OUTPUT: { text: string, confidence: number }
 */

import { parentPort, workerData } from 'worker_threads';
import { createWorker } from 'tesseract.js';
import fs from 'fs';

// Interface for worker data
export interface OCRWorkerData {
  filePath: string;
  language?: string;
}

// Interface for worker result
export interface OCRWorkerResult {
  text: string;
  confidence: number;
}

// Main execution function
async function runOCR() {
  if (!parentPort) {
    throw new Error('OCR_WORKER_ERROR: Must run inside a worker thread.');
  }

  const { filePath, language = 'eng' } = workerData as OCRWorkerData;

  // Paranoid validation inside the worker
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('OCR_WORKER_ERROR: Invalid file path provided.');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`OCR_WORKER_ERROR: File not found at ${filePath}`);
  }

  // Initialize Tesseract worker
  // Note: createWorker() is async in v5+
  const worker = await createWorker(language);

  try {
    // Recognize text
    const { data: { text, confidence } } = await worker.recognize(filePath);
    
    // Send result back to main thread
    const result: OCRWorkerResult = { text, confidence };
    parentPort.postMessage(result);
  } catch (error) {
    // Ensure error is serializable and clear
    throw new Error(`OCR_PROCESSING_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // Terminate worker to free memory immediately
    await worker.terminate();
  }
}

// Execute logic with top-level error catching
runOCR().catch((err) => {
  console.error('OCR Worker Critical Failure:', err);
  process.exit(1);
});
