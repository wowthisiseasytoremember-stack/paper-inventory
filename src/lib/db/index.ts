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
  console.log('Initializing Database Schema...');

  // Schema inlined so it works in production builds where src/ doesn't exist.
  // Keep schema.sql in sync for reference, but this is the runtime source of truth.
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'processing_ocr', 'ocr_complete', 'ocr_pending_retry', 'processing_resize', 'resize_complete', 'processing_ai', 'complete', 'error')),
        processingLock INTEGER DEFAULT 0,
        retryCount INTEGER DEFAULT 0,
        watchdogLockedAt DATETIME,
        errorMessage TEXT,
        title TEXT,
        guessedId TEXT,
        rawOcr TEXT,
        cleanedTranscription TEXT,
        confidence REAL,
        identifiedNames TEXT,
        historicalContext TEXT,
        collectorSignificance TEXT,
        verification_questions TEXT,
        aiRawResponse TEXT,
        analysis_history TEXT,
        originalHash TEXT,
        contentHash TEXT UNIQUE,
        originalFilename TEXT,
        mimeType TEXT,
        fileSize INTEGER,
        ocrLanguage TEXT DEFAULT 'eng',
        tags TEXT DEFAULT '[]',
        version INTEGER DEFAULT 1,
        lockedFields TEXT DEFAULT '[]',
        originalImagePath TEXT,
        resizedImagePath TEXT,
        thumbnailPath TEXT,
        ocrDurationMs INTEGER,
        resizeDurationMs INTEGER,
        aiDurationMs INTEGER,
        totalProcessingMs INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        statusUpdatedAt DATETIME,
        processedAt DATETIME,
        user_decision TEXT DEFAULT 'none',
        deletedAt DATETIME,
        collection_id TEXT,
        FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_processingLock ON items(processingLock);
    CREATE INDEX IF NOT EXISTS idx_items_contentHash ON items(contentHash);
    CREATE INDEX IF NOT EXISTS idx_items_createdAt ON items(createdAt);

    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        title,
        cleanedTranscription,
        identifiedNames,
        historicalContext,
        collectorSignificance,
        content='items',
        content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
        VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames, new.historicalContext, new.collectorSignificance);
    END;

    CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
        VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames, old.historicalContext, old.collectorSignificance);
    END;

    CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
        VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames, old.historicalContext, old.collectorSignificance);
        INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
        VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames, new.historicalContext, new.collectorSignificance);
    END;
  `);

  // Migration: add lockedFields column to existing databases
  try {
    db.exec('ALTER TABLE items ADD COLUMN lockedFields TEXT DEFAULT \'[]\'');
    console.log('[Migration] Added lockedFields column.');
  } catch (e) {
    // Column already exists — expected for existing DBs
  }

  // Migration: add verification_questions column to existing databases
  try {
    db.exec('ALTER TABLE items ADD COLUMN verification_questions TEXT');
    console.log('[Migration] Added verification_questions column.');
  } catch (e) {
    // Column already exists â€” expected for existing DBs
  }

  // Migration: add analysis_history column to existing databases
  try {
    db.exec('ALTER TABLE items ADD COLUMN analysis_history TEXT');
    console.log('[Migration] Added analysis_history column.');
  } catch (e) {
    // Column already exists â€” expected for existing DBs
  }

  // Migration: fix FK cascade on existing databases (SQLite can't ALTER FK,
  // but new databases get ON DELETE SET NULL from the CREATE above)

  // Migration: drop and recreate FTS5 triggers to fix broken column references
  // Old triggers referenced non-existent columns (identification, dealer_gut_check, ai_category).
  // DROP + recreate is safe — the FTS table is rebuilt from content='items'.
  try {
    db.exec(`
      DROP TRIGGER IF EXISTS items_ai;
      DROP TRIGGER IF EXISTS items_ad;
      DROP TRIGGER IF EXISTS items_au;
      DROP TABLE IF EXISTS items_fts;

      CREATE VIRTUAL TABLE items_fts USING fts5(
          title,
          cleanedTranscription,
          identifiedNames,
          historicalContext,
          collectorSignificance,
          content='items',
          content_rowid='rowid'
      );

      CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
        VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames, new.historicalContext, new.collectorSignificance);
      END;

      CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
        VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames, old.historicalContext, old.collectorSignificance);
      END;

      CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
        VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames, old.historicalContext, old.collectorSignificance);
        INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
        VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames, new.historicalContext, new.collectorSignificance);
      END;
    `);
    console.log('[Migration] FTS5 triggers recreated with correct columns.');
  } catch (e: any) {
    console.error('[Migration] Failed to recreate FTS5 triggers:', e.message);
  }

  console.log('Database Schema Initialized Successfully.');
}

// Auto-initialize on first import so the app never hits a missing-table 500
initSchema();
