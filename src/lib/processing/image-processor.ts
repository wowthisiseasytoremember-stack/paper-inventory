/**
 * IMAGE PROCESSOR (Hardened)
 * 
 * Handles strict image transformations:
 * 1. EXIF Auto-rotation
 * 2. Metadata Stripping (Privacy)
 * 3. Perspective Correction (Manual/Future) & Normalization
 * 4. Multi-stage Hashing (Integrity)
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
  
  process: async (id: string, originalPath: string): Promise<ImageProcessingResult> => {
    const start = Date.now();
    
    // 1. Calculate Original Hash (Stream)
    const originalHash = await calculateFileHash(originalPath);

    // 2. Initialize Sharp Pipeline
    const pipeline = sharp(originalPath, { failOnError: false });
    
    // Auto-rotate based on EXIF orientation
    // We do this BEFORE trim and metadata to ensure dimensions are correct
    const rotated = pipeline.rotate();
    
    const metadata = await rotated.metadata();
    
    // 3. Normalize & Pre-process for AI/OCR
    // - Resize to 1600px max
    // - Trim edges AFTER rotation
    const resizedBuffer = await rotated
      .resize(1600, 1600, { 
        fit: 'inside', 
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3 // High quality scaling
      })
      .trim()
      .sharpen({ sigma: 1.2 }) // Slight sharpen for text legibility
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    const resizedPath = StorageService.getResizedPath(id);
    fs.writeFileSync(resizedPath, resizedBuffer);

    // 4. Calculate Content Hash (Deduplication)
    const contentHash = crypto.createHash('sha256').update(resizedBuffer).digest('hex');

    // 5. Generate High-perf Thumbnail
    const thumbnailBuffer = await sharp(resizedBuffer)
      .resize(400, 400, { fit: 'cover' }) // Square cover is better for grid UI
      .webp({ quality: 70 })
      .toBuffer();
      
    const thumbnailPath = StorageService.getThumbnailPath(id);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return {
      originalHash,
      contentHash,
      resizedPath,
      thumbnailPath,
      mimeType: 'image/webp',
      width: metadata.width || 0,
      height: metadata.height || 0,
      resizeDurationMs: Date.now() - start
    };
  }
};

function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
