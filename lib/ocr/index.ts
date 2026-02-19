/**
 * OCR MANAGER
 * 
 * Orchestrates OCR jobs by dispatching them to worker threads.
 * Enforces timeouts, validation, and resource cleanup.
 */

import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';

const OCR_TIMEOUT_MS = 120 * 1000; // 120s timeout
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Performs OCR on the given file path in an isolated worker thread.
 * @param filePath Absolute path to the image file.
 * @param language Language code (default: 'eng').
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export function performOCR(filePath: string, language = 'eng'): Promise<{ text: string, confidence: number }> {
  return new Promise((resolve, reject) => {
    // 1. Validation: File Existence
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`OCR_FILE_NOT_FOUND: ${filePath}`));
    }

    // 2. Validation: File Size
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE_BYTES) {
      return reject(new Error(`OCR_FILE_TOO_LARGE: ${filePath} (${stats.size} bytes)`));
    }

    // 3. Worker Setup
    // Ensure we point to the compiled .js file in production or .ts in dev
    const workerPath = path.resolve(__dirname, '../../workers/ocr.worker.js').replace(/\.ts$/, '.js');
    
    // In development with tsx/ts-node, we might need to point to the .ts file directly if not compiled yet.
    // However, worker_threads usually expect JS. For simplicity in this robust setup, we assume a build step or ts-node registration in worker.
    // A common workaround for ts-node is passing executArgv. Let's try pointing to the .ts file if in dev.
    const isDev = process.env.NODE_ENV !== 'production';
    const finalWorkerPath = isDev ? path.resolve(__dirname, '../../workers/ocr.worker.ts') : workerPath;

    const worker = new Worker(finalWorkerPath, {
      workerData: { filePath, language },
      execArgv: isDev ? ['-r', 'ts-node/register'] : undefined // Enable TS support in worker
    });

    // 4. Timeout Handling (Watchdog)
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('OCR_TIMEOUT: Worker exceeded 120s limit'));
    }, OCR_TIMEOUT_MS);

    // 5. Event Listeners
    worker.on('message', (result) => {
      clearTimeout(timeout);
      resolve(result);
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`OCR_WORKER_ERROR: ${err.message}`));
    });

    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`OCR_WORKER_EXIT: Worker stopped with exit code ${code}`));
      }
    });
  });
}
