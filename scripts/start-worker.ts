#!/usr/bin/env node
/**
 * Background Worker Starter
 * Runs the processing scheduler loop independently from Next.js
 */

import { startProcessingLoop } from '@/lib/scheduler';

console.log('🚀 Starting background worker...');
console.log('Press Ctrl+C to stop\n');

// Start the processing loop
startProcessingLoop().catch((err) => {
  console.error('[Worker Fatal Error]', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down worker...');
  process.exit(0);
});
