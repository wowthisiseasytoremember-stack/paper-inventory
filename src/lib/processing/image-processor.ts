/**
 * IMAGE PROCESSOR
 * 
 * Handles strict image transformations:
 * 1. Metadata Stripping (Privacy)
 * 2. Resizing/Thumbnails (Optimization)
 * 3. Multi-stage Hashing (Integrity)
 */

import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
import { StorageService } from '../storage';

export interface ImageProcessingResult {
  originalHash: string;
  contentHash: string;
  resizedPath: string;
  thumbnailPath: string;
  mimeType: string;
  width: number;
  height: number;
  resizeDurationMs: number;
}

export const ImageProcessor = {
  
  /**
   * Processes an uploaded image:
   * - Calculates hash of original file.
   * - Strips metadata.
   * - Resizes to WebP (max 1200px equivalent).
   * - Generates Thumbnail.
   * - Calculates hash of processed content (deduplication key).
   */
  process: async (id: string, originalPath: string): Promise<ImageProcessingResult> => {
    const start = Date.now();
    
    // 1. Calculate Original Hash (Stream)
    // console.log(`[ImageProcessor] Hashing ${originalPath}...`);
    const originalHash = await calculateFileHash(originalPath);

    // Debug file stats
    const stats = fs.statSync(originalPath);
    console.log(`[ImageProcessor] Processing ${originalPath} (${stats.size} bytes)`);

    // 2. Initialize Sharp Pipeline
    const pipeline = sharp(originalPath, { failOnError: false });
    const metadata = await pipeline.metadata();

    // 3. Resize & Convert to WebP (Standard View)
    // Strip metadata is default in Sharp unless .withMetadata() is called
    const resizedBuffer = await pipeline
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const resizedPath = StorageService.getResizedPath(id);
    fs.writeFileSync(resizedPath, resizedBuffer);

    // 4. Calculate Content Hash (Post-processing)
    // This is the semantic hash for deduplication
    const contentHash = crypto.createHash('sha256').update(resizedBuffer).digest('hex');

    // 5. Generate Thumbnail
    const thumbnailBuffer = await sharp(resizedBuffer)
      .resize(300, 300, { fit: 'inside' })
      .webp({ quality: 60 })
      .toBuffer();
      
    const thumbnailPath = StorageService.getThumbnailPath(id);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return {
      originalHash,
      contentHash,
      resizedPath,
      thumbnailPath,
      mimeType: 'image/webp', // We standardizing on WebP
      width: metadata.width || 0,
      height: metadata.height || 0,
      resizeDurationMs: Date.now() - start
    };
  }
};

/**
 * Helper: SHA-256 of file stream
 */
function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
