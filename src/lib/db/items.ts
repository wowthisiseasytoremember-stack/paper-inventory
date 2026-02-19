/**
 * ITEM SERVICE (Database Layer)
 * 
 * Handles all direct database interactions for Items.
 * Enforces atomic locking and strict state transitions.
 */

import { db } from './index';
import { randomUUID } from 'crypto';

export type ItemStatus = 'queued' | 'processing_ocr' | 'ocr_complete' | 'processing_resize' | 'resize_complete' | 'processing_ai' | 'complete' | 'error';

export interface Item {
  id: string;
  status: ItemStatus;
  processingLock: number; // 0 or 1
  retryCount: number;
  errorMessage?: string;
  originalHash?: string;
  contentHash?: string;
  title?: string;
  guessedId?: string;
  rawOcr?: string;
  cleanedTranscription?: string;
  confidence?: number;
  identifiedNames?: string; // JSON
  historicalContext?: string;
  collectorSignificance?: string;
  originalImagePath?: string;
  createdAt: string; // ISO
  // New fields
  resizedImagePath?: string;
  thumbnailPath?: string;
  mimeType?: string;
  ocrDurationMs?: number;
  resizeDurationMs?: number;
  aiDurationMs?: number;
  totalProcessingMs?: number;
}

export const ItemService = {
  
  /**
   * Creates a new item in 'queued' state.
   */
  create: (filename: string, originalPath: string, mimeType: string, fileSize: number) => {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO items (id, originalFilename, originalImagePath, mimeType, fileSize, status)
      VALUES (?, ?, ?, ?, ?, 'queued')
    `);
    stmt.run(id, filename, originalPath, mimeType, fileSize);
    return id;
  },

  /**
   * ATOMIC LOCKING: Finds the next available job and locks it.
   * Returns undefined if no jobs are available.
   * 
   * Criteria:
   * 1. Status is 'queued' OR 'ocr_complete' OR 'resize_complete'
   * 2. processingLock is 0 (False)
   * 3. retryCount < 3
   */
  lockNext: (): Item | undefined => {
    // Transaction to ensure atomicity
    const lockTx = db.transaction(() => {
      // 1. Select the oldest unlocked job
      const item = db.prepare(`
        SELECT * FROM items 
        WHERE processingLock = 0 
          AND status IN ('queued', 'ocr_complete', 'resize_complete')
          AND retryCount < 3
        ORDER BY createdAt ASC
        LIMIT 1
      `).get() as Item | undefined;

      if (item) {
        // 2. Lock it immediately
        db.prepare(`
          UPDATE items 
          SET processingLock = 1, watchdogLockedAt = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(item.id);
        
        return { ...item, processingLock: 1 };
      }
      return undefined;
    });

    return lockTx();
  },

  /**
   * Releases the lock and updates status.
   */
  unlock: (id: string, newStatus: ItemStatus, updates: Partial<Item> = {}) => {
    const sets: string[] = ['processingLock = 0', 'watchdogLockedAt = NULL', 'status = ?'];
    const args: any[] = [newStatus];

    for (const [key, value] of Object.entries(updates)) {
      sets.push(`${key} = ?`);
      args.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
    args.push(id);

    const stmt = db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...args);
  },

  /**
   * Marks an item as failed and releases lock.
   */
  fail: (id: string, error: string) => {
    db.prepare(`
      UPDATE items 
      SET processingLock = 0, 
          watchdogLockedAt = NULL, 
          status = 'error', 
          errorMessage = ? 
      WHERE id = ?
    `).run(error, id);
  },
  
  /**
   * Resets all locks on startup (Crash Recovery).
   */
  resetLocks: () => {
    const info = db.prepare(`
      UPDATE items 
      SET processingLock = 0, watchdogLockedAt = NULL 
      WHERE processingLock = 1
    `).run();
    console.log(`[CrashRecovery] Reset ${info.changes} locked items.`);
  },

  getById: (id: string): Item | undefined => {
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item | undefined;
  }
};
