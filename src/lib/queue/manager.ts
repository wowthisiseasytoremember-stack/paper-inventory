/**
 * QUEUE MANAGER (v2 — single-pass pipeline)
 *
 * Processes each item through ALL stages in one lock cycle.
 * Uses p-queue for concurrency management.
 */

import { ItemService, Item } from '../db/items';
import { performOCR } from '../ocr';
import { db } from '../db';
import PQueue from 'p-queue';

const MAX_CONCURRENT_JOBS = 3;   // 3 concurrent full pipelines (each makes API calls)

export class QueueManager {
  private workerQueue = new PQueue({ concurrency: MAX_CONCURRENT_JOBS });
  private isRunning = false;
  private watchdogInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Queue] Started (p-queue mode, max concurrent:', MAX_CONCURRENT_JOBS, ')');
    
    ItemService.resetLocks();
    
    this.watchdogInterval = setInterval(() => {
      ItemService.resetStaleLocks(5);
      this.trigger();
    }, 60 * 1000);

    this.trigger();
  }

  stop() {
    this.isRunning = false;
    this.workerQueue.pause();
    this.workerQueue.clear();
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    console.log('[Queue] Stopped.');
  }

  trigger() {
    if (!this.isRunning) return;
    // Pull jobs from DB until no more are unlocked
    let item = ItemService.lockNext();
    while (item) {
      this.enqueueItem(item);
      item = ItemService.lockNext();
    }
  }

  private enqueueItem(item: Item) {
    this.workerQueue.add(() => this.processFullPipeline(item));
  }

  /**
   * Single-pass: OCR → Resize → AI all in one lock cycle.
   * No re-queuing. Item goes from queued → complete in one shot.
   */
  private async processFullPipeline(item: Item) {
    const pipelineStart = Date.now();
    console.log(`[Queue] 🚀 Full pipeline for ${item.id}`);

    try {
      // --- STAGE 1: OCR (if not already done) ---
      let rawOcr = item.rawOcr || '';
      let ocrConfidence = item.confidence || 0;

      if (item.status === 'queued') {
        if (item.originalImagePath) {
          db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_ocr', item.id);
          try {
            const ocrResult = await performOCR(item.originalImagePath);
            rawOcr = ocrResult.text;
            ocrConfidence = ocrResult.confidence;
            console.log(`[Queue] ✅ OCR done for ${item.id}`);
          } catch (ocrErr: any) {
            // OCR failure is non-fatal — vision models can read the image
            console.warn(`[Queue] ⚠️ OCR failed for ${item.id}, continuing without: ${ocrErr.message}`);
          }
        }
      }

      // --- STAGE 2: Resize (if not already done) ---
      let resizedPath = item.resizedImagePath;
      let thumbnailPath = item.thumbnailPath;
      let originalHash = item.originalHash;

      if (!resizedPath && item.originalImagePath) {
        db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_resize', item.id);
        const { ImageProcessor } = await import('../processing/image-processor');
        const result = await ImageProcessor.process(item.id, item.originalImagePath);
        resizedPath = result.resizedPath;
        thumbnailPath = result.thumbnailPath;
        console.log(`[Queue] ✅ Resize done for ${item.id} (${result.resizeDurationMs}ms)`);
      }

      // --- STAGE 3: AI (baseline → triage → grounding → deep dive) ---
      const imagePath = resizedPath || item.originalImagePath;
      if (!imagePath) throw new Error('No image path available');

      db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_ai', item.id);

      const { runFullPipeline } = await import('../ai');
      const aiStart = Date.now();
      const result = await runFullPipeline(imagePath, rawOcr, undefined, {
        onBaselineComplete: (baseline) => {
          // Write baseline data to DB immediately so UI can show title/tags while deep dive runs
          db.prepare('UPDATE items SET title = ?, tags = ?, confidence = ? WHERE id = ?')
            .run(baseline.title, JSON.stringify(baseline.tags || []), baseline.confidence || 0, item.id);
          console.log(`[Queue] ⚡ Baseline written early for ${item.id}: "${baseline.title}"`);
        },
      });
      const aiDurationMs = Date.now() - aiStart;

      // --- DONE: Unlock with everything ---
      const totalProcessingMs = Date.now() - pipelineStart;

      ItemService.unlock(item.id, 'complete', {
        rawOcr,
        confidence: ocrConfidence,
        originalHash,
        resizedImagePath: resizedPath,
        thumbnailPath,
        ...result.merged,
        aiDurationMs,
        totalProcessingMs,
        processedAt: new Date().toISOString(),
      });

      console.log(`[Queue] 🏁 Complete: ${item.id} [${result.category}] (${totalProcessingMs}ms total, ${aiDurationMs}ms AI, grounding: ${result.groundingUsed})`);

    } catch (error) {
      const duration = Date.now() - pipelineStart;
      console.error(`[Queue] ❌ Failed ${item.id} after ${duration}ms:`, error);
      ItemService.unlock(item.id, 'error', {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const queue = new QueueManager();
