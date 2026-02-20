import { queue } from '../src/lib/queue/manager';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(process.cwd(), '.env') });

console.log('Starting Queue Manager Process...');

// Start the manager (it handles its own lock resets)
queue.start();

// Keep process alive
process.on('SIGINT', () => {
  console.log('Worker stopping...');
  queue.stop();
  process.exit(0);
});
