/**
 * MIGRATION: ADD RESELLER FIELDS
 * 
 * Adds columns to support the Conductor/Expert enrichment flow.
 */

import { db } from '../src/lib/db';

async function migrate() {
  console.log('🚀 Starting Reseller Migration...');
  
  const columns = [
    { name: 'ai_category', type: 'TEXT' },
    { name: 'identification', type: 'TEXT' },
    { name: 'estimated_value', type: 'TEXT' },
    { name: 'liquidity_score', type: 'INTEGER' },
    { name: 'target_buy_price', type: 'TEXT' },
    { name: 'ebay_title', type: 'TEXT' },
    { name: 'comp_search_keywords', type: 'TEXT' }, // JSON
    { name: 'visible_flaws', type: 'TEXT' }, // JSON
    { name: 'dealer_gut_check', type: 'TEXT' },
    { name: 'research_pathways', type: 'TEXT' }, // JSON
    { name: 'uncertain_fields', type: 'TEXT' }, // JSON
    { name: 'item_specifics', type: 'TEXT' } // JSON
  ];

  for (const col of columns) {
    try {
      db.prepare(`ALTER TABLE items ADD COLUMN ${col.name} ${col.type}`).run();
      console.log(`✅ Added column: ${col.name}`);
    } catch (err: any) {
      if (err.message.includes('duplicate column name')) {
        console.log(`ℹ️ Column ${col.name} already exists, skipping.`);
      } else {
        console.error(`❌ Error adding column ${col.name}:`, err.message);
      }
    }
  }

  console.log('🏁 Migration Complete.');
}

migrate().catch(console.error);
