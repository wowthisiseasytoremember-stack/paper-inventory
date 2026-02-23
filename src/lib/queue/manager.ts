/**
 * QUEUE MANAGER (v2 — single-pass pipeline)
 *
 * Processes each item through ALL stages in one lock cycle.
 * No more re-queuing between stages.
 */

import { ItemService, Item } from '../db/items';
import { performOCR } from '../ocr';
import { db } from '../db';

const POLLING_INTERVAL_MS = 500; // Faster polling since items don't re-queue
const MAX_CONCURRENT_JOBS = 3;   // 3 concurrent full pipelines (each makes API calls)

export class QueueManager {
  private isRunning = false;
  private activeJobs = 0;
  private interval: NodeJS.Timeout | null = null;
  private watchdogInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Queue] Started (single-pass mode, max concurrent:', MAX_CONCURRENT_JOBS, ')');
    ItemService.resetLocks();
    this.watchdogInterval = setInterval(() => {
      ItemService.resetStaleLocks(5);
    }, 60 * 1000);
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.interval) clearTimeout(this.interval);
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    console.log('[Queue] Stopped.');
  }

  private async loop() {
    if (!this.isRunning) return;

    if (this.activeJobs < MAX_CONCURRENT_JOBS) {
      const item = ItemService.lockNext();
      if (item) {
        this.activeJobs++;
        this.processFullPipeline(item).finally(() => {
          this.activeJobs--;
        });
      }
    }

    this.interval = setTimeout(() => this.loop(), POLLING_INTERVAL_MS);
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
      let contentHash = item.contentHash;
      let originalHash = item.originalHash;

      if (!resizedPath && item.originalImagePath) {
        db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_resize', item.id);
        const { ImageProcessor } = await import('../processing/image-processor');
        const result = await ImageProcessor.process(item.id, item.originalImagePath);
        resizedPath = result.resizedPath;
        thumbnailPath = result.thumbnailPath;
        contentHash = result.contentHash;
        originalHash = result.originalHash;
        console.log(`[Queue] ✅ Resize done for ${item.id} (${result.resizeDurationMs}ms)`);
      }

      // --- STAGE 3: AI (baseline → triage → grounding → deep dive) ---
      const imagePath = resizedPath || item.originalImagePath;
      if (!imagePath) throw new Error('No image path available');

      db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_ai', item.id);

      const { runFullPipeline } = await import('../ai');
      const aiStart = Date.now();
      const result = await runFullPipeline(imagePath, rawOcr);
      const aiDurationMs = Date.now() - aiStart;

      // --- DONE: Unlock with everything ---
      const totalProcessingMs = Date.now() - pipelineStart;

      ItemService.unlock(item.id, 'complete', {
        rawOcr,
        confidence: ocrConfidence,
        originalHash,
        contentHash,
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
