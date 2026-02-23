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
    // Note: Items will have a NULL or dead collection_id if deleted. 
    // Usually we should handle this or foreign keys will prevent it if PRAGMA foreign_keys = ON.
    // In our schema, we have a foreign key.
    return db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  },

  getItems: (collectionId: string) => {
    return db.prepare('SELECT * FROM items WHERE collection_id = ? AND deletedAt IS NULL').all(collectionId);
  }
};
