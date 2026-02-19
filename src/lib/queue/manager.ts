/**
 * QUEUE MANAGER
 * 
 * Orchestrates the processing pipeline.
 * Polls for locked items and dispatches them to appropriate workers.
 */

import { ItemService, Item } from '../db/items';
import { performOCR } from '../ocr';
import { db } from '../db';

const POLLING_INTERVAL_MS = 2000;
const MAX_CONCURRENT_JOBS = 2;

export class QueueManager {
  private isRunning = false;
  private activeJobs = 0;
  private interval: NodeJS.Timeout | null = null;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Queue Manager Started.');
    
    // Reset any stale locks from previous crash
    const stmt = db.prepare('UPDATE items SET processingLock = 0, watchdogLockedAt = NULL WHERE processingLock = 1');
    stmt.run();

    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.interval) clearTimeout(this.interval);
    console.log('Queue Manager Stopped.');
  }

  private async loop() {
    if (!this.isRunning) return;

    if (this.activeJobs < MAX_CONCURRENT_JOBS) {
      const item = ItemService.lockNext();
      
      if (item) {
        this.activeJobs++;
        // Process asynchronously without awaiting here to allow concurrency
        this.processItem(item).finally(() => {
          this.activeJobs--;
          // Immediate triggers? For now, just let the loop catch it.
        });
      }
    }

    // Schedule next poll
    this.interval = setTimeout(() => this.loop(), POLLING_INTERVAL_MS);
  }

  private async processItem(item: Item) {
    console.log(`[Queue] Processing Item ${item.id} (Status: ${item.status})`);
    
    try {
      // STATE MACHINE ROUTER
      switch (item.status) {
        case 'queued':
          await this.handleOCR(item);
          break;
        case 'ocr_complete':
          await this.handleResize(item);
          // console.log(`[Queue] Item ${item.id} waiting for Resize (Not Implemented)`);
           // For now, just mark complete to test flow
          // ItemService.unlock(item.id, 'complete');
          break;
        case 'resize_complete':
          await this.handleAI(item);
           // console.log(`[Queue] Item ${item.id} waiting for AI (Not Implemented)`);
           // ItemService.unlock(item.id, 'complete');
          break;
        default:
          console.warn(`[Queue] Unknown state ${item.status} for item ${item.id}`);
          ItemService.unlock(item.id, 'error', { errorMessage: 'Unknown State' });
      }
    } catch (error) {
      console.error(`[Queue] Failed to process item ${item.id}:`, error);
      ItemService.unlock(item.id, 'error', { 
        errorMessage: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  // --- HANDLERS ---

  private async handleOCR(item: any) { // Type Item
    if (!item.originalImagePath) {
      throw new Error('Missing originalImagePath');
    }
    
    // Update status to processing (keeping lock implicitly via ID)
    db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_ocr', item.id);

    const result = await performOCR(item.originalImagePath);
    
    // Success -> ocr_complete
    ItemService.unlock(item.id, 'ocr_complete', {
      rawOcr: result.text,
      confidence: result.confidence,
      // ocrDurationMs: ... (Track in db/items if critical)
    });
    
    console.log(`[Queue] OCR Complete for ${item.id}`);
  }

  private async handleResize(item: any) {
    if (!item.originalImagePath) {
      throw new Error('Missing originalImagePath');
    }

    db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_resize', item.id);
    
    // Import dynamically to avoid circular dependency if laid out that way, 
    // or just import at top if clean.
    const { ImageProcessor } = await import('../processing/image-processor');

    const result = await ImageProcessor.process(item.id, item.originalImagePath);

    ItemService.unlock(item.id, 'resize_complete', {
      originalHash: result.originalHash,
      contentHash: result.contentHash,
      resizedImagePath: result.resizedPath,
      thumbnailPath: result.thumbnailPath,
      mimeType: result.mimeType,
      // width: result.width,
      // height: result.height,
      resizeDurationMs: result.resizeDurationMs
    });

    console.log(`[Queue] Resize & Hash Complete for ${item.id}`);
  }

  private async handleAI(item: any) {
    if (!item.resizedImagePath) {
      throw new Error('Missing resizedImagePath');
    }

    db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_ai', item.id);
    
    const { analyzeImage } = await import('../ai');

    // Use resized image for AI (faster upload, sufficient resolution)
    // Pass rawOcr as hint
    const metadata = await analyzeImage(item.resizedImagePath, item.rawOcr || '');

    ItemService.unlock(item.id, 'complete', {
      title: metadata.title,
      guessedId: metadata.guessedId,
      cleanedTranscription: metadata.cleanedTranscription,
      confidence: metadata.confidence,
      identifiedNames: JSON.stringify(metadata.identifiedNames),
      historicalContext: metadata.historicalContext,
      collectorSignificance: metadata.collectorSignificance,
      // aiDurationMs: ... (Track in db/items if critical)
      // totalProcessingMs: ... (Track total)
    });

    console.log(`[Queue] AI Analysis Complete for ${item.id}`);
  }
}

// Singleton
export const queue = new QueueManager();
