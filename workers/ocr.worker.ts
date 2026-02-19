/**
 * OCR WORKER THREAD
 * 
 * Runs Tesseract.js in a separate thread to prevent blocking the main event loop.
 * 
 * INPUT: { filePath: string, language?: string }
 * OUTPUT: { text: string, confidence: number }
 */

import { parentPort, workerData } from 'worker_threads';
import { createWorker } from 'tesseract.js';
import path from 'path';

// Interface for worker data
interface OCRWorkerData {
  filePath: string;
  language?: string;
}

// Main execution function
async function runOCR() {
  const { filePath, language = 'eng' } = workerData as OCRWorkerData;

  if (!filePath) {
    throw new Error('OCR_WORKER_ERROR: No file path provided');
  }

  // Initialize Tesseract worker
  const worker = await createWorker(language);

  try {
    // Recognize text
    const { data: { text, confidence } } = await worker.recognize(filePath);
    
    // Send result back to main thread
    parentPort?.postMessage({ text, confidence });
  } catch (error) {
    throw error;
  } finally {
    // Terminate worker to free memory
    await worker.terminate();
  }
}

// Execute logic
runOCR().catch((err) => {
  console.error('OCR Worker Failed:', err);
  process.exit(1);
});
