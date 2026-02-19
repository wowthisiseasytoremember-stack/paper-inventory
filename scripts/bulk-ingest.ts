import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createItem } from '../lib/db/items';

const SOURCE_DIR = 'C:/Users/wowth/Downloads/Photos-1-0101';
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'original');

async function ingest() {
  console.log(`Ingesting from ${SOURCE_DIR}...`);
  
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    .slice(0, 3); // Grab 3 for testing

  for (const filename of files) {
    const sourcePath = path.join(SOURCE_DIR, filename);
    const extension = path.extname(filename);
    const storageFilename = `${crypto.randomUUID()}${extension}`;
    const targetPath = path.join(UPLOAD_DIR, storageFilename);

    console.log(`Processing ${filename} -> ${storageFilename}`);

    // Copy file
    fs.copyFileSync(sourcePath, targetPath);

    // Get file info
    const stats = fs.statSync(targetPath);
    const buffer = fs.readFileSync(targetPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(buffer);
    const hexHash = hashSum.digest('hex');

    // Create DB entry
    const id = createItem({
      originalFilename: filename,
      originalImagePath: targetPath,
      mimeType: 'image/jpeg',
      fileSize: stats.size,
      originalHash: hexHash,
      contentHash: hexHash,
    });

    console.log(`Created item ${id}`);
  }

  console.log('Bulk ingestion complete.');
}

ingest().catch(console.error);
