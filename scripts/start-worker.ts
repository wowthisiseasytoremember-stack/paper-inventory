
import { startProcessingLoop } from '../src/lib/processing/scheduler';
import { ItemService } from '../src/lib/db/items';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(process.cwd(), '.env') });

console.log('Starting Worker Process...');

// Cleanup any locks from crashed previous runs
ItemService.resetLocks();

// Start the polling loop
startProcessingLoop(2000); // Poll every 2 seconds

// Keep process alive
process.on('SIGINT', () => {
  console.log('Worker stopping...');
  process.exit(0);
});
