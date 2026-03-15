/**
 * PREPARE TEST ASSETS
 * Resizes the copied real images for E2E testing.
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { resizeImage } from '../src/lib/processing/resize';

async function prepare() {
  const assets = ['real-test-1.jpg', 'real-test-2.jpg'];
  const testAssetsDir = path.join(process.cwd(), 'test-assets');
  const outputDir = path.join(testAssetsDir, 'resized');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🖼️  Resizing real-world test assets...');

  for (const asset of assets) {
    const inputPath = path.join(testAssetsDir, asset);
    if (!fs.existsSync(inputPath)) {
      console.error(`❌ File not found: ${inputPath}`);
      continue;
    }

    try {
      const result = await resizeImage(inputPath, asset.split('.')[0], outputDir);
      console.log(`✅ Resized ${asset}: ${result.resizedPath}`);
    } catch (err: any) {
      console.error(`❌ Failed to resize ${asset}: ${err.message}`);
    }
  }
}

prepare();
