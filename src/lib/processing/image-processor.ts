/**
 * IMAGE PROCESSOR (Hardened)
 * 
 * Handles strict image transformations:
 * 1. EXIF Auto-rotation
 * 2. Metadata Stripping (Privacy)
 * 3. Perspective Correction (Manual/Future) & Normalization
 */

import sharp from 'sharp';
import fs from 'fs';
import { StorageService } from '../storage';

export interface ImageProcessingResult {
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
    
    // 1. Initialize Sharp Pipeline
    const pipeline = sharp(originalPath, { failOnError: false });
    
    // Auto-rotate based on EXIF orientation
    // We do this BEFORE trim and metadata to ensure dimensions are correct
    const rotated = pipeline.rotate();
    
    const metadata = await rotated.metadata();
    
    // 2. Normalize & Pre-process for AI/OCR
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

    // 3. Generate High-perf Thumbnail
    const thumbnailBuffer = await sharp(resizedBuffer)
      .resize(400, 400, { fit: 'cover' }) // Square cover is better for grid UI
      .webp({ quality: 70 })
      .toBuffer();
      
    const thumbnailPath = StorageService.getThumbnailPath(id);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return {
      resizedPath,
      thumbnailPath,
      mimeType: 'image/webp',
      width: metadata.width || 0,
      height: metadata.height || 0,
      resizeDurationMs: Date.now() - start
    };
  }
};
