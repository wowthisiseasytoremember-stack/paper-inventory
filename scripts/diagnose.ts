import { db } from '../src/lib/db';
import fs from 'fs';
const errors = db.prepare(`SELECT id, errorMessage, status FROM items WHERE status = 'error'`).all();
fs.writeFileSync('errors.json', JSON.stringify(errors, null, 2));
