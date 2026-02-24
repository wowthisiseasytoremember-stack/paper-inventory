#!/usr/bin/env node
/**
 * GCV Test Script
 * Tests Google Cloud Vision API credentials and OCR on 4 test images
 */

import path from 'path';
import fs from 'fs';
import { ImageAnnotatorClient } from '@google-cloud/vision';

const TEST_IMAGES_DIR = 'C:/Users/wowth/Downloads/Photos-1-001';
const testImages = [
  '20260117_202149.jpg',
  '20260117_202152.jpg',
  '20260117_202141.jpg',
  '20260117_202145.jpg'
];

console.log('🧪 Starting Google Cloud Vision Test...\n');

// Initialize Vision client (uses GOOGLE_APPLICATION_CREDENTIALS env var)
let client: ImageAnnotatorClient;

try {
  client = new ImageAnnotatorClient();
  console.log('✅ Vision client initialized\n');
} catch (err: any) {
  console.error('❌ Failed to initialize Vision client:');
  console.error(`   Error: ${err.message}`);
  console.error(`   Make sure GOOGLE_APPLICATION_CREDENTIALS points to valid service key`);
  process.exit(1);
}

console.log('Test images found:');
testImages.forEach(img => {
  const fullPath = path.join(TEST_IMAGES_DIR, img);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${exists ? '✅' : '❌'} ${img}`);
});

async function testOCR() {
  console.log('🔍 Testing OCR on 4 comic images...\n');

  let successCount = 0;
  let failureCount = 0;

  for (const imageName of testImages) {
    const fullPath = path.join(TEST_IMAGES_DIR, imageName);

    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  ${imageName}: File not found, skipping`);
      continue;
    }

    try {
      // Read image file
      const imageBuffer = fs.readFileSync(fullPath);
      const base64Image = imageBuffer.toString('base64');

      // Call Vision API
      const request = {
        image: { content: base64Image },
      };

      const [result] = await client.textDetection(request);
      const detections = result.textAnnotations || [];

      if (detections.length === 0) {
        console.log(`⚠️  ${imageName}: No text detected`);
        failureCount++;
        continue;
      }

      // First result is full text
      const fullText = detections[0].description || '';
      const textPreview = fullText.substring(0, 100).replace(/\n/g, ' ');
      const confidence = detections[0].confidence || 0;

      console.log(`✅ ${imageName}`);
      console.log(`   Text: "${textPreview}..."`);
      console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%\n`);

      successCount++;
    } catch (err: any) {
      console.log(`❌ ${imageName}: ${err.message}\n`);
      failureCount++;
    }
  }

  // Summary
  console.log(`\n📊 Results: ${successCount}/${testImages.length} succeeded`);
  if (failureCount > 0) {
    console.error(`⚠️  ${failureCount} images failed`);
    process.exit(1);
  }
}

// Run test
testOCR().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
