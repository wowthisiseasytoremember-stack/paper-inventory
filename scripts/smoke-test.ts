import assert from 'assert';
import { ItemService } from '../src/lib/db/items';
import { queue } from '../src/lib/queue/manager';
import fs from 'fs';
import path from 'path';

async function testFileUploadAndQueue() {
  console.log('--- Smoke Test: File Upload & Queue (Polling Mode) ---');

  // 1. Setup a valid test image
  const dummyImagePath = path.join(process.cwd(), 'test-image.png');
  if (!fs.existsSync(dummyImagePath)) {
    console.error('❌ test-image.png not found. Please ensure it exists.');
    process.exit(1);
  }
  
  // 2. Create a new item (simulating the API)
  const newItemId = ItemService.create('smoke-test.png', dummyImagePath, 'image/png', 100);
  assert(newItemId, 'ItemService.create should return an ID');
  console.log(`✅ [1/3] Item created in DB with ID: ${newItemId}`);

  // Start the queue manager
  queue.start();

  // 3. Poll for status changes
  console.log('Polling for item completion...');
  let processedItem: any = null;
  const maxAttempts = 60; // 60 * 2 seconds = 120 seconds max
  let attempts = 0;

  while (attempts < maxAttempts) {
    processedItem = ItemService.getById(newItemId);
    if (!processedItem) {
      console.error('❌ Item disappeared from DB!');
      break;
    }

    process.stdout.write(`Attempt ${attempts + 1}/${maxAttempts}: Status = ${processedItem.status}    \r`);

    if (processedItem.status === 'complete') {
      console.log('\n✅ [2/3] Item processed successfully by the queue.');
      break;
    }

    if (processedItem.status === 'error') {
      console.log(`\n❌ Item failed with error: ${processedItem.errorMessage}`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  assert(processedItem && processedItem.status === 'complete', `Item status is ${processedItem?.status}, expected complete`);
  
  // 4. Verify valuation
  assert(processedItem.estimated_value_point !== null || processedItem.estimated_value_low !== null, 'Item should have a valuation');
  console.log('✅ [3/3] Item has a valuation.');

  // Cleanup
  // ItemService.softDelete(newItemId); // Keep it for manual inspection if needed

  console.log('--- Smoke Test Passed ---');
  // Stop the queue manager to allow the script to exit
  queue.stop();
}

testFileUploadAndQueue().catch(err => {
  console.error('\n--- Smoke Test Failed ---');
  console.error(err);
  queue.stop();
  process.exit(1);
});
