/**
 * DATABASE SETUP SCRIPT
 * Run this to initialize the hardened SQLite schema.
 */

import { initSchema, db } from '../lib/db';

async function main() {
  try {
    console.log('Starting DB Migration...');
    initSchema();
    
    // Quick smoke test
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
    console.log('Tables Created:', tables);

    console.log('DB Setup Complete.');
    process.exit(0);
  } catch (error) {
    console.error('DB Setup Failed:', error);
    process.exit(1);
  }
}

main();
