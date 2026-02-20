
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { ItemService } from '../src/lib/db/items';
import { QueueManager } from '../src/lib/queue/manager';
import { db } from '../src/lib/db';

// Load env
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function createInternalTestImage() {
  console.log('   (debug) Generating valid 800x1000 PNG test image...');
  return sharp({
    create: {
      width: 800,
      height: 1000,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .png()
  .toBuffer();
}

async function runTest() {
  console.log('🧪 Starting E2E Pipeline Test...');

  // 1. Setup
  const queue = new QueueManager();
  const testDir = path.join(process.cwd(), 'data', 'test-e2e');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  // Clear DB
  const info = db.prepare('DELETE FROM items').run();
  console.log(`🧹 Cleared DB (Deleted ${info.changes} rows).`);

  const count = db.prepare('SELECT count(*) as c FROM items').get() as { c: number };
  console.log(`   Internal Check: ${count.c} items in DB.`);

  try {
    // 2. Create Test Image
    console.log('📸 Generating synthetic receipt...');
    const buffer = await createInternalTestImage();
    const filePath = path.join(testDir, `test-receipt-${Date.now()}.png`);
    fs.writeFileSync(filePath, buffer);

    // 3. Inject into DB
    console.log('📥 Injecting item into DB...');
    const id = ItemService.create('test-receipt.png', filePath, 'image/png', buffer.length);
    console.log(`   Item ID: ${id}`);

    // 4. Start Queue
    console.log('🚀 Starting Queue Manager...');
    queue.start();

    // 5. Poll for completion
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s timeout
    
    const interval = setInterval(async () => {
      attempts++;
      const item = ItemService.getById(id);
      
      if (!item) {
        console.error('❌ Item disappeared!');
        clearInterval(interval);
        queue.stop();
        process.exit(1);
      }

      process.stdout.write(`\r👀 Status [${attempts}/${maxAttempts}]: ${item.status} `);

      if (item.status === 'complete') {
        clearInterval(interval);
        queue.stop();
        console.log('\n\n✅ Pipeline Success!');
        console.log('--------------------------------------------------');
        console.log(`Title: ${item.title}`);
        console.log(`Date: ${item.historicalContext}`); // Often mapped here or in transcription
        console.log(`Context: ${item.historicalContext}`);
        console.log(`Confidence: ${item.confidence}`);
        console.log(`OCR Text (Preview): ${item.rawOcr?.substring(0, 100)}...`);
        console.log(`Resized Path: ${item.resizedImagePath}`);
        console.log('--------------------------------------------------');
        
        // Assertions
        if (!item.resizedImagePath) throw new Error('Missing resized image');
        if (!item.thumbnailPath) throw new Error('Missing thumbnail');
        if (!item.rawOcr) throw new Error('Missing OCR text');
        
        console.log('🎉 All assertions passed.');
        process.exit(0);
      } else if (item.status === 'error') {
        clearInterval(interval);
        queue.stop();
        console.error(`\n\n❌ Pipeline Failed: ${item.errorMessage}`);
        process.exit(1);
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        queue.stop();
        console.error('\n\n❌ Timeout waiting for completion');
        process.exit(1);
      }

    }, 2000);

  } catch (error) {
    console.error('\n❌ Test Error:', error);
    queue.stop();
    process.exit(1);
  }
}

runTest();
