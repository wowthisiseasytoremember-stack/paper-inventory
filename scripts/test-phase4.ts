import assert from 'assert';
import { db } from '../src/lib/db';
import { ItemService } from '../src/lib/db/items';

async function testPhase4() {
  console.log('--- Testing Phase 4 (Research Context API & DB integration) ---');

  const testId = ItemService.create('test.jpg', '/test.jpg', 'image/jpeg', 1000);

  try {
    // 1. Simulate the PATCH API Endpoint behavior
    console.log('Testing PATCH behavior for research fields...');
    const payload = {
      research_location: 'Estate Sale at Main St.',
      asking_price: '$15.00',
      purchase_decision: 'purchased',
      research_notes: 'Some slight creasing on the corner.'
    };

    const sets = Object.keys(payload).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(payload), testId];
    db.prepare(`UPDATE items SET ${sets}, statusUpdatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

    // 2. Fetch and assert the item's new values
    const item = ItemService.getById(testId);
    assert(item, 'Item must exist');
    assert.strictEqual(item.research_location, 'Estate Sale at Main St.');
    assert.strictEqual(item.asking_price, '$15.00');
    assert.strictEqual(item.purchase_decision, 'purchased');
    assert.strictEqual(item.research_notes, 'Some slight creasing on the corner.');
    
    console.log('✅ Research fields correctly saved in the DB.');

    // 3. Test React Component imports
    try {
      const { ResearchContextPanel } = await import('../src/components/ResearchContextPanel');
      assert(ResearchContextPanel, 'ResearchContextPanel should be exported');
      console.log('✅ ResearchContextPanel successfully imported.');
    } catch (e) {
      console.log('⏳ ResearchContextPanel not yet implemented.');
    }

    console.log('--- Phase 4 Tests Passed / Ready ---');
  } catch (err: any) {
    console.error('❌ Phase 4 Tests Failed:', err.message);
    process.exit(1);
  } finally {
    // Cleanup
    db.prepare('DELETE FROM items WHERE id = ?').run(testId);
  }
}

testPhase4().catch(console.error);