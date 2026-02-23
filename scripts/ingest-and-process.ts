import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ItemService } from '../src/lib/db/items';
import { QueueManager } from '../src/lib/queue/manager';
import { db } from '../src/lib/db';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const FILES = [
  'C:/Users/wowth/Downloads/Photos-1-0101/20260117_173931.jpg',
  'C:/Users/wowth/Downloads/Photos-1-0101/20260117_174038.jpg',
  'C:/Users/wowth/Downloads/Photos-1-0101/20260117_174144.jpg',
  'C:/Users/wowth/Downloads/Photos-1-0101/20260117_173921.jpg'
];

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'original');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function hashFile(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function ingestFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Ingest] Missing file: ${filePath}`);
    return null;
  }

  ensureUploadDir();
  const filename = path.basename(filePath);
  const extension = path.extname(filename);
  const storageFilename = `${crypto.randomUUID()}${extension}`;
  const targetPath = path.join(UPLOAD_DIR, storageFilename);

  const originalHash = hashFile(filePath);
  const existing = db.prepare('SELECT id FROM items WHERE originalHash = ?').get(originalHash) as { id: string } | undefined;
  if (existing) {
    console.log(`[Ingest] Skipping duplicate: ${filename} (Existing ID: ${existing.id})`);
    return existing.id;
  }

  fs.copyFileSync(filePath, targetPath);
  const stats = fs.statSync(targetPath);

  const id = ItemService.create(filename, targetPath, 'image/jpeg', stats.size);
  db.prepare('UPDATE items SET originalHash = ? WHERE id = ?').run(originalHash, id);

  console.log(`[Ingest] Created item ${id} for ${filename}`);
  return id;
}

async function run() {
  console.log('--- Ingest & Process ---');
  const ids = FILES.map(ingestFile).filter(Boolean) as string[];
  if (ids.length === 0) {
    console.log('No items ingested. Exiting.');
    return;
  }

  const queue = new QueueManager();
  queue.start();

  const pending = new Set(ids);
  const maxAttempts = 90; // 3 minutes @ 2s interval
  let attempts = 0;

  const interval = setInterval(() => {
    attempts++;
    const done: string[] = [];

    for (const id of pending) {
      const item = ItemService.getById(id);
      if (!item) continue;

      if (item.status === 'complete') {
        done.push(id);
        console.log(`\n✅ COMPLETE ${id}`);
        console.log(`Title: ${item.title}`);
        console.log(`Guessed ID: ${item.guessedId}`);
        console.log(`Valuation: ${item.valuation}`);
        console.log(`Context: ${item.historicalContext}`);
        console.log(`Significance: ${item.collectorSignificance}`);
        console.log(`Tags: ${item.tags}`);
        console.log(`Verification Qs: ${item.verification_questions}`);
        console.log(`Confidence: ${item.confidence}`);
      } else if (item.status === 'error') {
        done.push(id);
        console.log(`\n❌ ERROR ${id}: ${item.errorMessage}`);
      }
    }

    done.forEach(id => pending.delete(id));
    process.stdout.write(`\rStatus: ${pending.size} pending (attempt ${attempts}/${maxAttempts})`);

    if (pending.size === 0) {
      clearInterval(interval);
      queue.stop();
      console.log('\nAll items processed.');
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      queue.stop();
      console.log('\nTimeout waiting for items to complete.');
    }
  }, 2000);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
