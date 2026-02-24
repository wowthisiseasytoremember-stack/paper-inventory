/**
 * MIGRATION: ADD DECISION FIELD
 * 
 * Adds user_decision column to support Buy/Pass workflow.
 */

import { db } from '../src/lib/db';

async function migrate() {
  console.log('🚀 Adding Decision Field...');
  
  try {
    db.prepare(`ALTER TABLE items ADD COLUMN user_decision TEXT DEFAULT 'none'`).run();
    console.log(`✅ Added column: user_decision`);
  } catch (err: any) {
    if (err.message.includes('duplicate column name')) {
      console.log(`ℹ️ Column user_decision already exists, skipping.`);
    } else {
      console.error(`❌ Error adding column:`, err.message);
    }
  }

  console.log('🏁 Migration Complete.');
}

migrate().catch(console.error);
