
import { db } from '../src/lib/db';
import { Item } from '../src/lib/db/items';

const items = db.prepare('SELECT * FROM items ORDER BY createdAt DESC LIMIT 5').all() as Item[];

console.log('--- Last 5 Items ---');
items.forEach(item => {
  console.log(`ID: ${item.id}`);
  console.log(`Status: ${item.status}`);
  console.log(`Lock: ${item.processingLock}`);
  console.log(`Error: ${item.errorMessage || 'None'}`);
  console.log('------------------');
});
