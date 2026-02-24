/**
 * Image Resizing with Sharp
 * Generates thumbnail (300px) and web version (1024px)
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const THUMBNAIL_WIDTH = 300;
const WEB_WIDTH = 1024;
const QUALITY = 80;

export async function resizeImage(originalPath: string, itemId: string, outputDir: string = 'data/resized'): Promise<{
  thumbnailPath: string;
  resizedPath: string;
  durationMs: number;
}> {
  const startTime = Date.now();

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const thumbnailPath = path.join(outputDir, `${itemId}-thumb.jpg`);
  const resizedPath = path.join(outputDir, `${itemId}-web.jpg`);

  try {
    // Create thumbnail
    await sharp(originalPath)
      .resize(THUMBNAIL_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toFile(thumbnailPath);

    // Create web version
    await sharp(originalPath)
      .resize(WEB_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toFile(resizedPath);

    const durationMs = Date.now() - startTime;

    console.log(`[Resize] ${itemId}: thumbnail + web version created (${durationMs}ms)`);

    return { thumbnailPath, resizedPath, durationMs };
  } catch (err: any) {
    throw new Error(`[Resize Failed] ${itemId}: ${err.message}`);
  }
}
