import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ItemService } from '../src/lib/db/items';
import { db } from '../src/lib/db';

const SOURCE_DIR = 'C:/Users/wowth/Downloads/Photos-1-0101';
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'original');

async function ingest() {
  console.log(`Ingesting from ${SOURCE_DIR}...`);
  
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    .slice(0, 10); // Grab 10 for testing

  for (const filename of files) {
    const sourcePath = path.join(SOURCE_DIR, filename);
    const extension = path.extname(filename);
    const storageFilename = `${crypto.randomUUID()}${extension}`;
    const targetPath = path.join(UPLOAD_DIR, storageFilename);

    console.log(`Processing ${filename} -> ${storageFilename}`);

    // Copy file
    fs.copyFileSync(sourcePath, targetPath);

    // 3. Hash Calculation (for Deduplication)
    const buffer = fs.readFileSync(sourcePath);
    const originalHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate
    const existing = db.prepare('SELECT id FROM items WHERE originalHash = ?').get(originalHash) as { id: string } | undefined;
    if (existing) {
      console.log(`[Ingest] Skipping duplicate: ${filename} (Existing ID: ${existing.id})`);
      continue;
    }

    // 4. Copy file
    fs.copyFileSync(sourcePath, targetPath);
    const stats = fs.statSync(targetPath);

    // 5. DB Injection
    const id = ItemService.create(filename, targetPath, 'image/jpeg', stats.size);
    db.prepare('UPDATE items SET originalHash = ? WHERE id = ?').run(originalHash, id);

    console.log(`Created item ${id} for ${filename}`);
  }

  console.log('Bulk ingestion complete.');
}

ingest().catch(console.error);
