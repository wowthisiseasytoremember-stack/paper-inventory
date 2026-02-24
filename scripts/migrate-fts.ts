/**
 * MIGRATION: REFRESH FTS SEARCH
 * 
 * Recreates the FTS5 table with the new research and valuation fields.
 */

import { db } from '../src/lib/db';

async function migrate() {
  console.log('🔍 Refreshing FTS Search Index...');
  
  const tx = db.transaction(() => {
    // 1. Drop old triggers
    db.prepare('DROP TRIGGER IF EXISTS items_ai').run();
    db.prepare('DROP TRIGGER IF EXISTS items_ad').run();
    db.prepare('DROP TRIGGER IF EXISTS items_au').run();
    
    // 2. Drop old FTS table
    db.prepare('DROP TABLE IF EXISTS items_fts').run();
    
    // 3. Create new FTS table
    db.prepare(`
      CREATE VIRTUAL TABLE items_fts USING fts5(
        title, 
        identification,
        cleanedTranscription, 
        identifiedNames, 
        dealer_gut_check,
        ai_category,
        content='items', 
        content_rowid='rowid'
      )
    `).run();
    
    // 4. Create new triggers
    db.prepare(`
      CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, title, identification, cleanedTranscription, identifiedNames, dealer_gut_check, ai_category) 
        VALUES (new.rowid, new.title, new.identification, new.cleanedTranscription, new.identifiedNames, new.dealer_gut_check, new.ai_category);
      END;
    `).run();
    
    db.prepare(`
      CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, identification, cleanedTranscription, identifiedNames, dealer_gut_check, ai_category) 
        VALUES('delete', old.rowid, old.title, old.identification, old.cleanedTranscription, old.identifiedNames, old.dealer_gut_check, old.ai_category);
      END;
    `).run();
    
    db.prepare(`
      CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, identification, cleanedTranscription, identifiedNames, dealer_gut_check, ai_category) 
        VALUES('delete', old.rowid, old.title, old.identification, old.cleanedTranscription, old.identifiedNames, old.dealer_gut_check, old.ai_category);
        INSERT INTO items_fts(rowid, title, identification, cleanedTranscription, identifiedNames, dealer_gut_check, ai_category) 
        VALUES (new.rowid, new.title, new.identification, new.cleanedTranscription, new.identifiedNames, new.dealer_gut_check, new.ai_category);
      END;
    `).run();
    
    // 5. Re-index all existing data
    db.prepare(`
      INSERT INTO items_fts(rowid, title, identification, cleanedTranscription, identifiedNames, dealer_gut_check, ai_category)
      SELECT rowid, title, identification, cleanedTranscription, identifiedNames, dealer_gut_check, ai_category FROM items WHERE deletedAt IS NULL
    `).run();
  });

  tx();
  console.log('🏁 FTS Search Index Updated Successfully.');
}

migrate().catch(console.error);
