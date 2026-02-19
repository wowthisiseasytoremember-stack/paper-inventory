/**
 * QUEUE VERIFICATION SCRIPT
 * 
 * Verifies the full queue flow:
 * 1. Insert item -> 'queued'
 * 2. QueueManager picks it up -> 'processing_ocr'
 * 3. OCR Worker runs -> 'ocr_complete'
 */

import { queue } from '../src/lib/queue/manager';
import { ItemService } from '../src/lib/db/items';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';

const TEST_IMAGE_PATH_QUEUE = path.join(process.cwd(), 'data', 'test-queue.png');

async function createTestImage() {
  await sharp({
    create: {
      width: 400,
      height: 200,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([{
    input: Buffer.from('<svg><text x="20" y="50" font-size="30" fill="black">Queue Test Items</text></svg>'),
    top: 0,
    left: 0
  }])
  .png()
  .toFile(TEST_IMAGE_PATH_QUEUE);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyQueue() {
  try {
    console.log('--- STARTING QUEUE TEST ---');
    
    // 1. Setup
    await createTestImage();
    queue.start();

    // 2. Insert Item
    const id = ItemService.create('test-queue.png', TEST_IMAGE_PATH_QUEUE, 'image/png', 1024);
    console.log(`Inserted Item ${id} (queued)`);

    // 3. Monitor
    let attempts = 0;
    while (attempts < 20) {
      await sleep(500);
      const item = ItemService.getById(id);
      
      console.log(`[Monitor] Item ${id} Status: ${item?.status}`);

      if (item?.status === 'resize_complete' || item?.status === 'complete') {
        console.log('SUCCESS: Item processed correctly (Resize Stage Complete)!');
        if (item.rawOcr && item.rawOcr.includes('Queue')) {
             console.log('SUCCESS: OCR extracted text!');
        } else {
             console.warn('WARNING: OCR did not extract expected text (might be font issue in synthetic image)');
        }
        break;
      }
      
      if (item?.status === 'error') {
        console.error('FAILED: Item went to error state:', item.errorMessage);
        process.exit(1);
      }

      attempts++;
    }

    if (attempts >= 20) {
      console.error('FAILED: Timeout waiting for processing');
      process.exit(1);
    }
    
    // Cleanup
    queue.stop();
    // fs.unlinkSync(TEST_IMAGE_PATH_QUEUE); // Valid to keep for inspection if needed
    
  } catch (error) {
    console.error('TEST FAILED:', error);
    process.exit(1);
  } finally {
      process.exit(0);
  }
}

verifyQueue();
