import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');
const RESIZED_DIR = path.join(UPLOAD_ROOT, 'resized');
const THUMBNAIL_DIR = path.join(UPLOAD_ROOT, 'thumbnails');

// Ensure directories exist
[RESIZED_DIR, THUMBNAIL_DIR].forEach(dir => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

interface ResizeResult {
  resizedPath: string;
  thumbnailPath: string;
  durationMs: number;
}

export async function processImage(
  inputPath: string, 
  originalFilename: string
): Promise<ResizeResult> {
  const start = Date.now();
  const baseName = path.basename(originalFilename, path.extname(originalFilename));
  const timestamp = Date.now();
  
  // naming convention: uuid-timestamp-size.webp
  const resizedFilename = `${baseName}-${timestamp}-web.webp`;
  const thumbnailFilename = `${baseName}-${timestamp}-thumb.webp`;
  
  const resizedPath = path.join(RESIZED_DIR, resizedFilename);
  const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);

  // Parallel processing
  await Promise.all([
    // 1. Web Version (Max 1024px width, 80% quality WebP)
    sharp(inputPath)
      .resize({ width: 1024, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(resizedPath),

    // 2. Thumbnail (Max 300px width, 60% quality WebP)
    sharp(inputPath)
      .resize({ width: 300, withoutEnlargement: true })
      .webp({ quality: 60 })
      .toFile(thumbnailPath)
  ]);

  return {
    resizedPath: `/uploads/resized/${resizedFilename}`, // Store relative URL for frontend
    thumbnailPath: `/uploads/thumbnails/${thumbnailFilename}`,
    durationMs: Date.now() - start
  };
}
