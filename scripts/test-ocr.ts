/**
 * OCR WORKER VERIFICATION SCRIPT
 * 
 * Generates a synthetic receipt image using Sharp and verifies text extraction.
 * No external files required.
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { performOCR } from '../lib/ocr';

const TEST_IMAGE_PATH = path.join(process.cwd(), 'data', 'test-receipt.png');

async function createTestImage() {
  console.log('Generating synthetic test image...');
  
  // Create an SVG with text
  const svgImage = `
  <svg width="400" height="200">
    <style>
      .title { fill: #000; font-size: 24px; font-weight: bold; font-family: sans-serif; }
      .item { fill: #333; font-size: 16px; font-family: monospace; }
    </style>
    <rect width="100%" height="100%" fill="white" />
    <text x="20" y="40" class="title">Store #1234</text>
    <text x="20" y="80" class="item">Milk..........$3.50</text>
    <text x="20" y="110" class="item">Eggs..........$5.00</text>
    <text x="20" y="140" class="item">Total.........$8.50</text>
  </svg>
  `;

  await sharp(Buffer.from(svgImage))
    .png()
    .toFile(TEST_IMAGE_PATH);
    
  console.log(`Test image saved to: ${TEST_IMAGE_PATH}`);
}

async function verifyOCR() {
  try {
    // 1. Generate Image
    await createTestImage();

    // 2. Run OCR
    console.log('Running OCR in isolated worker...');
    const start = Date.now();
    const result = await performOCR(TEST_IMAGE_PATH);
    const duration = Date.now() - start;

    console.log(`OCR Completed in ${duration}ms`);
    console.log('--- RAW RESULT ---');
    console.log(result.text);
    console.log('------------------');
    console.log(`Confidence: ${result.confidence}`);

    // 3. Assertions
    const expectedWords = ['Store', 'Milk', 'Eggs', 'Total', '8.50'];
    const missing = expectedWords.filter(w => !result.text.includes(w));

    if (missing.length > 0) {
      console.error('FAILED: Missing expected words:', missing);
      process.exit(1);
    }

    console.log('SUCCESS: OCR Worker verifies correctly!');
    
    // Cleanup
    fs.unlinkSync(TEST_IMAGE_PATH);
    
  } catch (error) {
    console.error('TEST FAILED:', error);
    process.exit(1);
  }
}

// Run
verifyOCR();
