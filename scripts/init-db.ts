
import { initSchema } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

// Force delete in dev if needed, or just run initSchema
const DB_PATH = path.join(process.cwd(), 'data', 'dev.db');

if (process.argv.includes('--force')) {
    console.log('Dropping old tables...');
    const db = require('better-sqlite3')(DB_PATH);
    db.prepare('DROP TABLE IF EXISTS items').run();
    db.prepare('DROP TABLE IF EXISTS items_fts').run();
    db.close();
}

initSchema();
