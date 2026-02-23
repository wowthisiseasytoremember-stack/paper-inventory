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
  valuation?: string;
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
  processedAt?: string; // ISO
  tags?: string; // JSON
  verification_questions?: string; // JSON
  collection_id?: string;
  analysis_history?: string; // JSON array of past deep dives
}

export const ItemService = {
  
  /**
   * Creates a new item in 'queued' state.
   */
  create: (filename: string, originalPath: string, mimeType: string, fileSize: number, originalHash?: string) => {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO items (id, originalFilename, originalImagePath, mimeType, fileSize, status, originalHash)
      VALUES (?, ?, ?, ?, ?, 'queued', ?)
    `);
    stmt.run(id, filename, originalPath, mimeType, fileSize, originalHash ?? null);
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
          AND deletedAt IS NULL
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
      SET processingLock = 0, watchdogLockedAt = NULL, status = 'error', errorMessage = 'System crash detected during processing'
      WHERE processingLock = 1
    `).run();
    console.log(`[CrashRecovery] Reset ${info.changes} locked items.`);
  },

  /**
   * Resets locks that have been held for too long (Runtime Watchdog).
   * @param timeoutMinutes Minutes after which a lock is considered stale.
   */
  resetStaleLocks: (timeoutMinutes = 5) => {
    const info = db.prepare(`
      UPDATE items 
      SET processingLock = 0, 
          watchdogLockedAt = NULL, 
          status = 'error', 
          errorMessage = 'Processing timed out (Watchdog)',
          retryCount = retryCount + 1
      WHERE processingLock = 1 
        AND watchdogLockedAt IS NOT NULL
        AND watchdogLockedAt < datetime('now', '-${timeoutMinutes} minutes')
    `).run();
    if (info.changes > 0) {
      console.warn(`[Watchdog] Reset ${info.changes} stale locked items.`);
    }
  },

  getById: (id: string): Item | undefined => {
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item | undefined;
  },

  /**
   * Finds an item by its original file hash (pre-processing dedup).
   */
  getByOriginalHash: (hash: string): Item | undefined => {
    return db.prepare('SELECT * FROM items WHERE originalHash = ? AND deletedAt IS NULL').get(hash) as Item | undefined;
  },

  /**
   * Updates user-editable metadata fields.
   * Strict whitelist prevents mutation of system fields.
   */
  updateMetadata: (id: string, updates: Record<string, any>) => {
    const EDITABLE = [
      'title', 'guessedId', 'cleanedTranscription', 'historicalContext', 
      'collectorSignificance', 'tags', 'valuation', 'verification_questions', 
      'collection_id', 'analysis_history'
    ];
    const sets: string[] = [];
    const args: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (EDITABLE.includes(key)) {
        sets.push(`${key} = ?`);
        args.push(value);
      }
    }
    if (sets.length === 0) return { changes: 0 };
    args.push(id);
    return db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  },

  /**
   * Updates status/metadata WITHOUT releasing the lock.
   */
  updateStatus: (id: string, newStatus: ItemStatus, updates: Partial<Item> = {}) => {
    const sets: string[] = ['status = ?'];
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
   * Finds an item by its content hash (for deduplication).
   */
  getByContentHash: (hash: string): Item | undefined => {
    return db.prepare('SELECT * FROM items WHERE contentHash = ? AND deletedAt IS NULL').get(hash) as Item | undefined;
  },

  /**
   * Soft deletes an item.
   */
  softDelete: (id: string) => {
    db.prepare('UPDATE items SET deletedAt = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  /**
   * Returns all non-deleted items.
   */
  getAll: (limit = 100, offset = 0): Item[] => {
    return db.prepare(`
      SELECT * FROM items 
      WHERE deletedAt IS NULL 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Item[];
  }
};
