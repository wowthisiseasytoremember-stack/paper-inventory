/**
 * MIGRATION: Add statusUpdatedAt column if missing
 */

import { db } from '../src/lib/db';

function columnExists(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some(r => r.name === column);
}

async function migrate() {
  const table = 'items';
  const column = 'statusUpdatedAt';
  if (columnExists(table, column)) {
    console.log(`[Migration] ${column} already exists on ${table}.`);
    return;
  }

  console.log(`[Migration] Adding ${column} to ${table}...`);
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} DATETIME`).run();
  console.log('[Migration] Backfilling statusUpdatedAt...');
  db.prepare(`UPDATE ${table} SET ${column} = COALESCE(${column}, createdAt, CURRENT_TIMESTAMP)`).run();
  console.log('[Migration] Done.');
}

migrate().catch((err) => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});
