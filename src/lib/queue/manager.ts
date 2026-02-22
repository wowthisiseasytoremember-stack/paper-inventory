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
  private watchdogInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Queue Manager Started.');
    
    // Reset any stale locks from previous crash
    ItemService.resetLocks();

    // Start Runtime Watchdog (checks every 1 minute)
    this.watchdogInterval = setInterval(() => {
      ItemService.resetStaleLocks(5); // Reset locks older than 5 minutes
    }, 60 * 1000);

    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.interval) clearTimeout(this.interval);
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
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
    const startTime = Date.now();
    console.log(`[Queue] 🚀 Processing Item ${item.id} (Status: ${item.status})`);
    
    try {
      // STATE MACHINE ROUTER
      switch (item.status) {
        case 'queued':
          // Move directly to Resize. Gemini will handle text.
          db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_resize', item.id);
          await this.handleResize(item);
          break;
        case 'ocr_complete':
          await this.handleResize(item);
          break;
        case 'resize_complete':
          await this.handleAI(item);
          break;
        default:
          console.warn(`[Queue] ⚠️ Unknown state ${item.status} for item ${item.id}`);
          ItemService.unlock(item.id, 'error', { errorMessage: 'Unknown State' });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Queue] ❌ Failed to process item ${item.id} after ${duration}ms:`, error);
      ItemService.unlock(item.id, 'error', { 
        errorMessage: error instanceof Error ? error.message : String(error) 
        // totalProcessingMs can be updated here too if partial progress was made
      });
    }
  }

  // --- HANDLERS ---

  private async handleOCR(item: any) {
    if (!item.originalImagePath) {
      throw new Error('Missing originalImagePath');
    }
    
    db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_ocr', item.id);

    const result = await performOCR(item.originalImagePath);
    
    ItemService.unlock(item.id, 'ocr_complete', {
      rawOcr: result.text,
      confidence: result.confidence,
    });
    
    console.log(`[Queue] ✅ OCR Complete for ${item.id}`);
  }

  private async handleResize(item: any) {
    if (!item.originalImagePath) {
      throw new Error('Missing originalImagePath');
    }

    db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_resize', item.id);
    
    const { ImageProcessor } = await import('../processing/image-processor');
    const result = await ImageProcessor.process(item.id, item.originalImagePath);

    ItemService.unlock(item.id, 'resize_complete', {
      originalHash: result.originalHash,
      contentHash: result.contentHash,
      resizedImagePath: result.resizedPath,
      thumbnailPath: result.thumbnailPath,
      mimeType: result.mimeType,
      resizeDurationMs: result.resizeDurationMs
    });

    console.log(`[Queue] ✅ Resize & Hash Complete for ${item.id} (${result.resizeDurationMs}ms)`);
  }

  private async handleAI(item: any) {
    if (!item.resizedImagePath) {
      throw new Error('Missing resizedImagePath');
    }

    db.prepare('UPDATE items SET status = ? WHERE id = ?').run('processing_ai', item.id);
    
    const { analyzeImage } = await import('../ai');

    const startTime = Date.now();
    const metadata = await analyzeImage(item.resizedImagePath, item.rawOcr || '');
    const aiDurationMs = Date.now() - startTime;

    // Calculate total processing time from creation
    const createdDate = new Date(item.createdAt).getTime();
    const totalProcessingMs = Date.now() - createdDate;

    ItemService.unlock(item.id, 'complete', {
      title: metadata.title,
      guessedId: metadata.guessedId,
      cleanedTranscription: metadata.cleanedTranscription,
      confidence: metadata.confidence,
      identifiedNames: JSON.stringify(metadata.identifiedNames),
      historicalContext: metadata.historicalContext,
      collectorSignificance: metadata.collectorSignificance,
      valuation: metadata.valuation,
      
      // Metrics & Completion
      aiDurationMs,
      totalProcessingMs,
      processedAt: new Date().toISOString(),
      rawOcr: metadata.cleanedTranscription,
      tags: JSON.stringify(metadata.tags || [])
    });

    console.log(`[Queue] 🏁 AI Analysis Complete for ${item.id} (AI: ${aiDurationMs}ms, Total: ${totalProcessingMs}ms)`);
  }
}

// Singleton
export const queue = new QueueManager();
