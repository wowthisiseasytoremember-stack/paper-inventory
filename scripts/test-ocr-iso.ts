
import { performOCR } from '../src/lib/ocr';
import path from 'path';

async function testOCR() {
  const imagePath = path.join(process.cwd(), 'data', 'test-e2e', 'test-receipt.jpg');
  // If no file exists, use a dummy path to trigger error or ensure one exists
  console.log(`Testing OCR on ${imagePath}...`);
  try {
     const result = await performOCR(imagePath);
     console.log('OCR Success:', result.text.substring(0, 50));
  } catch (err) {
     console.error('OCR Failed:', err);
  }
}

testOCR().catch(err => console.error('Top Level Error:', err));
