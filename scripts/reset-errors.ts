/**
 * Reset all errored items back to 'queued' so the worker can retry them.
 */
import 'dotenv/config';
import { db } from '../src/lib/db';

const result = db.prepare(
  `UPDATE items 
   SET status = 'queued', 
       errorMessage = NULL, 
       processingLock = 0, 
       watchdogLockedAt = NULL 
   WHERE status = 'error'`
).run();

console.log(`✅ Reset ${result.changes} items from 'error' → 'queued'`);
