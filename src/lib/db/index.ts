/**
 * SAFE DATABASE PROVIDER
 * Singleton instance of Better-SQLite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || path.join(process.cwd(), 'data', 'dev.db');

// Ensure parent directory exists
const parentDir = path.dirname(DB_PATH);
if (!fs.existsSync(parentDir)) {
  fs.mkdirSync(parentDir, { recursive: true });
}

// Singleton pattern for Next.js hot reloading
// Prevents multiple connections from locking the DB
const globalForDb = global as unknown as { db: Database.Database };

export const db = globalForDb.db || new Database(DB_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initSchema() {
  const schemaPath = path.join(process.cwd(), 'src/lib/db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  console.log('Initializing Database Schema...');
  db.exec(schema);
  console.log('Database Schema Initialized Successfully.');
}
