import fs from 'fs';
import { StorageService } from '../storage';
import { Jimp } from 'jimp';

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
    
    // 1. Read the image with Jimp
    const image = await Jimp.read(originalPath);

    const width = image.width;
    const height = image.height;

    // 2. Create Resized version
    const resizedImage = image.clone().resize({ w: 1024 });
    const resizedPath = StorageService.getResizedPath(id, '.jpg');
    // @ts-ignore - Jimp v1 typing issues in some environments
    await resizedImage.write(resizedPath);

    // 3. Create Thumbnail
    const thumbImage = image.clone().resize({ w: 256 });
    const thumbnailPath = StorageService.getThumbnailPath(id, '.jpg');
    // @ts-ignore
    await thumbImage.write(thumbnailPath);

    return {
      resizedPath,
      thumbnailPath,
      mimeType: 'image/jpeg',
      width,
      height,
      resizeDurationMs: Date.now() - start
    };
  }
};
