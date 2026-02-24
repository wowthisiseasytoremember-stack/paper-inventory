
/**
 * Fix FTS5 Triggers
 *
 * The merge conflict resolution changed the schema and what data is available,
 * but the FTS triggers were not updated. This script drops the old triggers
 * and FTS table, and recreates them with the correct columns and logic to
 * ensure the full-text search index is comprehensive and up-to-date.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

console.log('--- FTS5 Trigger Fix Script ---');

// --- Database Connection ---
// Replicates the logic from src/lib/db/index.ts to safely connect to the DB.
const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || path.join(process.cwd(), 'data', 'dev.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Error: Database file not found at ${DB_PATH}`);
  console.error('Please ensure the database exists before running this script.');
  process.exit(1);
}

console.log(`Connecting to database at ${DB_PATH}...`);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
console.log('Database connection successful.');

// --- Trigger and FTS Table Recreation ---
try {
  console.log('Dropping old FTS triggers and table...');
  db.exec(`
    DROP TRIGGER IF EXISTS items_ai;
    DROP TRIGGER IF EXISTS items_ad;
    DROP TRIGGER IF EXISTS items_au;
    DROP TABLE IF EXISTS items_fts;
  `);
  console.log('Old artifacts dropped successfully.');

  console.log('Creating new, expanded FTS5 table...');
  // New table includes historicalContext and collectorSignificance for better search
  db.exec(`
    CREATE VIRTUAL TABLE items_fts USING fts5(
        title,
        cleanedTranscription,
        identifiedNames,
        historicalContext,
        collectorSignificance,
        content='items',
        content_rowid='rowid'
    );
  `);
  console.log('New FTS5 table created.');

  console.log('Creating new triggers for insert, update, and delete...');
  db.exec(`
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
  console.log('New triggers created successfully.');

  console.log('Re-populating FTS table from existing data...');
  db.exec(`
    INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance)
    SELECT rowid, title, cleanedTranscription, identifiedNames, historicalContext, collectorSignificance FROM items;
  `);
  console.log('FTS table re-populated.');

  console.log('--- Script finished successfully! ---');

} catch (error) {
  console.error('An error occurred:', error);
  process.exit(1);
} finally {
  db.close();
  console.log('Database connection closed.');
}
