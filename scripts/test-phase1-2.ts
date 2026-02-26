import { db } from '../src/lib/db';
import { ItemService } from '../src/lib/db/items';
import assert from 'assert';

async function testPhase1and2() {
  console.log('--- Testing Phase 1 & 2 ---');

  // 1. Check DB columns exist
  console.log('Testing DB Schema...');
  const tableInfo = db.pragma('table_info(items)') as any[];
  const columns = tableInfo.map(c => c.name);
  
  const expectedColumns = [
    'research_location', 'asking_price', 'purchase_decision', 'research_notes',
    'estimated_value_low', 'estimated_value_high', 'estimated_value_point',
    'value_confidence', 'is_high_value', 'ebay_keywords', 'category', 'research_stage'
  ];

  for (const col of expectedColumns) {
    if (!columns.includes(col)) {
      throw new Error(`Missing column in items table: ${col}`);
    }
  }
  console.log('✅ All Phase 1 columns exist in DB.');

  // 2. Test updateValuation in ItemService
  console.log('Testing ItemService.updateValuation...');
  const mockId = ItemService.create('test.jpg', '/test.jpg', 'image/jpeg', 1000);
  
  ItemService.updateValuation(mockId, {
    estimated_value_low: 10,
    estimated_value_high: 50,
    estimated_value_point: 30,
    value_confidence: 'medium',
    is_high_value: false,
    ebay_keywords: 'test keyword'
  });

  const item = ItemService.getById(mockId);
  assert(item, 'Item should exist');
  assert.strictEqual(item.estimated_value_low, 10);
  assert.strictEqual(item.estimated_value_high, 50);
  assert.strictEqual(item.estimated_value_point, 30);
  assert.strictEqual(item.value_confidence, 'medium');
  assert.strictEqual(item.is_high_value, 0); // SQLite stores boolean as 0/1
  assert.strictEqual(item.ebay_keywords, 'test keyword');
  assert.strictEqual(item.research_stage, 'valued');
  console.log('✅ updateValuation works correctly.');

  // Clean up
  db.prepare('DELETE FROM items WHERE id = ?').run(mockId);
  console.log('✅ Cleanup complete.');
  
  console.log('--- Phase 1 & 2 Tests Passed ---');
}

testPhase1and2().catch(console.error);
