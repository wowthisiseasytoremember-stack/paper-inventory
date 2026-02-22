import { db } from '../src/lib/db';

try {
  console.log('Adding valuation column...');
  db.prepare('ALTER TABLE items ADD COLUMN valuation TEXT').run();
  console.log('✅ Column added successfully.');
} catch (e: any) {
  if (e.message.includes('duplicate column name')) {
    console.log('ℹ️ Column already exists.');
  } else {
    console.error('❌ Failed to add column:', e.message);
  }
} finally {
  process.exit(0);
}
