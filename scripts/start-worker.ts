/**
 * ARCHIVE WORKER
 * 
 * Standalone process to handle OCR, Image Resizing, and AI Enrichment.
 * Running this separately from Next.js avoids SQLite locking issues.
 */

import { queue } from '../src/lib/queue/manager';
import { ItemService } from '../src/lib/db/items';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('--- VAULT ARCHIVE WORKER STARTING ---');
  console.log(`Time: ${new Date().toISOString()}`);
  
  // 1. Crash Recovery: Reset any stuck locks from previous runs
  console.log('[Worker] Running crash recovery...');
  ItemService.resetLocks();

  // 2. Start the processing loop
  console.log('[Worker] Entering main processing loop...');
  
  // The queue manager handles polling indefinitely
  queue.start();
}

main().catch(err => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
