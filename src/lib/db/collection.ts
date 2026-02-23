/**
 * COLLECTION SERVICE (Database Layer)
 * 
 * Handles all database interactions for Collections.
 */

import { db } from './index';
import { randomUUID } from 'crypto';

export interface Collection {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
}

export const CollectionService = {
  
  create: (name: string, description?: string, icon?: string) => {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO collections (id, name, description, icon)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, name, description ?? null, icon ?? null);
    return id;
  },

  getAll: (): Collection[] => {
    return db.prepare('SELECT * FROM collections ORDER BY name ASC').all() as Collection[];
  },

  getById: (id: string): Collection | undefined => {
    return db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as Collection | undefined;
  },

  update: (id: string, updates: Partial<Collection>) => {
    const sets: string[] = [];
    const args: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'description', 'icon'].includes(key)) {
        sets.push(`${key} = ?`);
        args.push(value);
      }
    }
    if (sets.length === 0) return { changes: 0 };
    args.push(id);
    return db.prepare(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  },

  delete: (id: string) => {
    // Unlink items first to satisfy FK constraints and keep items intact.
    const tx = db.transaction(() => {
      db.prepare('UPDATE items SET collection_id = NULL WHERE collection_id = ?').run(id);
      db.prepare('DELETE FROM collections WHERE id = ?').run(id);
    });
    return tx();
  },

  getItems: (collectionId: string) => {
    return db.prepare('SELECT * FROM items WHERE collection_id = ? AND deletedAt IS NULL').all(collectionId);
  }
};
