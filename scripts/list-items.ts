/**
 * List items with their status and title for quick verification.
 */
import 'dotenv/config';
import { db } from '../src/lib/db';

const items = db.prepare('SELECT id, status, title, processedAt, errorMessage FROM items ORDER BY createdAt DESC').all() as any[];

console.log(`\n📊 Total Items: ${items.length}\n`);

const grouped: Record<string, number> = {};
for (const item of items) {
  grouped[item.status] = (grouped[item.status] || 0) + 1;
}
console.log('Status Breakdown:', grouped);
console.log('');

for (const item of items) {
  const icon = item.status === 'complete' ? '✅' : item.status === 'error' ? '❌' : '⏳';
  console.log(`${icon} [${item.status.padEnd(15)}] ${(item.title || 'Untitled').padEnd(40)} ID: ${item.id.substring(0, 8)}...`);
  if (item.errorMessage) console.log(`   └─ Error: ${item.errorMessage.substring(0,80)}`);
}
