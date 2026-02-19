/**
 * UPLOAD API VALIDATION SCRIPT
 * 
 * Verifies the logic of the Upload API by simulating a request.
 * Tests Validation, Storage, and Queue Injection.
 */

import { POST } from '../src/app/api/upload/route';
import { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';

const TEST_IMAGE_PATH = path.join(process.cwd(), 'data', 'test-upload.png');

// Create dummy image if needed
if (!fs.existsSync(TEST_IMAGE_PATH)) {
    fs.writeFileSync(TEST_IMAGE_PATH, Buffer.alloc(1024)); // 1KB dummy
}

async function verifyUpload() {
  console.log('Testing Upload API Logic...');

  try {
    // 1. Prepare Mock Request
    const fileBuffer = fs.readFileSync(TEST_IMAGE_PATH);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'test-upload.png');

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    // 2. Call Handler Directly
    const response = await POST(req);
    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 201 && data.status === 'queued') {
        console.log('SUCCESS: Upload logic verified!');
    } else {
        console.error('FAILED: Unexpected response');
        process.exit(1);
    }

  } catch (error) {
    console.error('TEST FAILED:', error);
    process.exit(1);
  }
}

verifyUpload();
