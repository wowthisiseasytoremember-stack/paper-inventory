/**
 * QUEUE MANAGER
 * 
 * Orchestrates the processing pipeline.
 * Polls for locked items and dispatches them to appropriate workers.
 */

import { ItemService, Item } from '../db/items';
import { performOCR } from '../ocr';
import { extractValuation } from '../ai/valuator';

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
          // Move directly to Resize. OpenAI will handle text.
          ItemService.updateStatus(item.id, 'processing_resize');
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
    
    ItemService.updateStatus(item.id, 'processing_ocr');

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

    ItemService.updateStatus(item.id, 'processing_resize');
    
    const { ImageProcessor } = await import('../processing/image-processor');
    const result = await ImageProcessor.process(item.id, item.originalImagePath);

    ItemService.unlock(item.id, 'resize_complete', {
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

    ItemService.updateStatus(item.id, 'processing_ai');
    
    const { analyzeImage } = await import('../ai');

    const startTime = Date.now();
    
    // Provide a callback to receive fast initial routing info
    const metadata = await analyzeImage(item.resizedImagePath, item.rawOcr || '', (route) => {
      ItemService.updateStatus(item.id, 'processing_ai', {
        title: `Identified as: ${route.category.replace(/_/g, ' ')}`,
        category: route.category,
        confidence: route.confidence_score
      });
      console.log(`[Queue] ⚡ Fast ID complete for ${item.id}: ${route.category}`);
    });
    
    const aiDurationMs = Date.now() - startTime;
    
    // Call valuator to get structured valuation
    const valuation = await extractValuation(
      metadata.title || '',
      metadata.ai_category || '',
      metadata.historicalContext || '',
      metadata.collectorSignificance || '',
      metadata.valuation || '',
      metadata.cleanedTranscription || ''
    );

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
      
      // Reseller Fields
      ai_category: metadata.ai_category,
      category: metadata.ai_category, // map to new research field
      identification: metadata.identification,
      estimated_value: metadata.valuation, // Map estimated_value to database valuation field for compatibility
      liquidity_score: metadata.liquidity_score,
      target_buy_price: metadata.target_buy_price,
      ebay_title: metadata.ebay_title,
      comp_search_keywords: JSON.stringify(metadata.comp_search_keywords),
      visible_flaws: JSON.stringify(metadata.visible_flaws),

      research_pathways: JSON.stringify(metadata.research_pathways),
      uncertain_fields: JSON.stringify(metadata.uncertain_fields),
      item_specifics: JSON.stringify(metadata.item_specifics),

      // Structured Valuation Fields
      ...(valuation ? {
        estimated_value_low: valuation.estimated_value_low,
        estimated_value_high: valuation.estimated_value_high,
        estimated_value_point: valuation.estimated_value_point,
        value_confidence: valuation.value_confidence,
        is_high_value: valuation.is_high_value,
        ebay_keywords: valuation.ebay_keywords,
        research_stage: 'valued'
      } : {
        research_stage: 'identified'
      }),

      // Metrics & Completion
      aiDurationMs,
      totalProcessingMs,
      processedAt: new Date().toISOString(),
      rawOcr: metadata.cleanedTranscription,
      tags: JSON.stringify(metadata.tags || [])
    });

    console.log(`[Queue] 🏁 AI Analysis & Valuation Complete for ${item.id} (AI: ${aiDurationMs}ms, Total: ${totalProcessingMs}ms)`);
  }
}

// Singleton
export const queue = new QueueManager();
