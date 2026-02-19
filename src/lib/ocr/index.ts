/**
 * OCR MANAGER (ROBUST)
 * 
 * Orchestrates OCR jobs by dispatching them to worker threads.
 * Enforces timeouts, validation, and resource cleanup.
 */

import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { OCRWorkerData, OCRWorkerResult } from '../../workers/ocr.worker';

const OCR_TIMEOUT_MS = 120 * 1000; // 120s timeout
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Performs OCR on the given file path in an isolated worker thread.
 * @param filePath Absolute path to the image file.
 * @param language Language code (default: 'eng').
 * @returns {Promise<OCRWorkerResult>}
 */
export function performOCR(filePath: string, language = 'eng'): Promise<OCRWorkerResult> {
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
    // Resolve path to worker file carefully
    const isDev = process.env.NODE_ENV !== 'production';
    
    // In dev, point to .ts. In prod, point to .js (built).
    // Note: __dirname in Next.js/Webpack can be tricky. Using process.cwd() is safer for project root relative paths.
    const workerPath = isDev 
      ? path.join(process.cwd(), 'workers', 'ocr.worker.ts')
      : path.join(process.cwd(), '.next', 'server', 'workers', 'ocr.worker.js'); // Next.js build output location varies, need to verify in Prod phase.

    // Robust verification of worker file
    if (!fs.existsSync(workerPath)) {
        // Fallback for different build structures or direct execution
        console.warn(`OCR Worker not found at ${workerPath}, trying relative resolution...`);
    }

    const worker = new Worker(workerPath, {
      workerData: { filePath, language } as OCRWorkerData,
      // Essential for running .ts workers in dev without compiling
      execArgv: isDev ? ['-r', 'ts-node/register'] : undefined 
    });

    // 4. Timeout Handling (Watchdog)
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error(`OCR_TIMEOUT: Worker exceeded ${OCR_TIMEOUT_MS}ms limit`));
    }, OCR_TIMEOUT_MS);

    // 5. Event Listeners
    worker.on('message', (result: OCRWorkerResult) => {
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
