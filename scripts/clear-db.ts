
import { db } from '../src/lib/db';
db.prepare('DELETE FROM items').run();
console.log('Cleared items table.');
