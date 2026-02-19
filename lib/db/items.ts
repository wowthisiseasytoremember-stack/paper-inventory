import { db } from './index';
import { randomUUID } from 'crypto';

export interface Item {
  id: string;
  status: 'queued' | 'processing_ocr' | 'ocr_complete' | 'processing_resize' | 'resize_complete' | 'processing_ai' | 'complete' | 'error';
  processingLock: number; // 0 or 1
  retryCount: number;
  watchdogLockedAt: string | null;
  errorMessage: string | null;
  title: string | null;
  originalFilename: string;
  originalImagePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  // Add other fields as needed
}

/**
 * Creates a new item in the 'queued' state.
 */
export function createItem(data: {
  originalFilename: string;
  originalImagePath: string;
  mimeType: string;
  fileSize: number;
  originalHash: string;
  contentHash: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO items (
      id, status, originalFilename, originalImagePath, mimeType, fileSize, originalHash, contentHash
    ) VALUES (
      @id, 'queued', @originalFilename, @originalImagePath, @mimeType, @fileSize, @originalHash, @contentHash
    )
  `);

  const id = randomUUID();
  stmt.run({ ...data, id });
  return id;
}

/**
 * Atomically finds the next pending item and locks it.
 * Prioritizes items that have been waiting the longest.
 */
export function lockNextPendingItem(): Item | undefined {
  // We use a transaction to ensure atomic check-and-set
  const lockTransaction = db.transaction(() => {
    const item = db.prepare(`
      SELECT * FROM items
      WHERE processingLock = 0
      AND status NOT IN ('complete', 'error')
      ORDER BY createdAt ASC
      LIMIT 1
    `).get() as Item | undefined;

    if (item) {
      db.prepare(`
        UPDATE items
        SET processingLock = 1, watchdogLockedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(item.id);
      return item;
    }
    return undefined;
  });

  return lockTransaction();
}

/**
 * Updates an item's status and releases the lock.
 */
export function updateItemStatus(
  id: string, 
  newStatus: string, 
  updates: Partial<Item> = {}
) {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  const setClause = fields ? `, ${fields}` : '';
  
  const stmt = db.prepare(`
    UPDATE items
    SET status = @status, processingLock = 0, watchdogLockedAt = NULL, processedAt = CURRENT_TIMESTAMP ${setClause}
    WHERE id = @id
  `);

  stmt.run({ ...updates, status: newStatus, id });
}

/**
 * Marks an item as failed and releases the lock.
 */
export function failItem(id: string, errorMessage: string) {
  db.prepare(`
    UPDATE items
    SET status = 'error', processingLock = 0, watchdogLockedAt = NULL, errorMessage = ?
    WHERE id = ?
  `).run(errorMessage, id);
}

/**
 * Releases a lock without changing status (e.g. if worker crashes/restarts).
 * This acts as a reset.
 */
export function releaseLock(id: string) {
  db.prepare(`
    UPDATE items
    SET processingLock = 0, watchdogLockedAt = NULL
    WHERE id = ?
  `).run(id);
}

/**
 * Maintenance: Resets locks on items that have been stuck for too long (e.g., > 5 mins).
 * Call this on server startup.
 */
export function resetStaleLocks() {
    const info = db.prepare(`
        UPDATE items
        SET processingLock = 0, watchdogLockedAt = NULL, retryCount = retryCount + 1
        WHERE processingLock = 1
    `).run();
    if (info.changes > 0) {
        console.log(`[DB] Reset ${info.changes} stale locks.`);
    }
}
