/**
 * UPLOAD API ENDPOINT
 * 
 * Handles file uploads securely:
 * 1. Validates file size and type (magic bytes).
 * 2. Saves original file to secure storage.
 * 3. Creates 'queued' item in DB.
 * 4. Returns Item ID to client for polling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage';
import { ItemService } from '@/lib/db/items';
import { queue } from '@/lib/queue/manager'; // Ensure queue is imported to start if needed (or start in instrumentation)
import fs from 'fs';
import { fileTypeFromBuffer } from 'file-type';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// Ensure queue is running (lazy start)
queue.start();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Size Validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (Max 25MB)' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 2. Magic Byte Validation (Security)
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !ALLOWED_MIMES.includes(type.mime)) {
      return NextResponse.json({ 
        error: `Invalid file type: ${type?.mime || 'unknown'}. Allowed: ${ALLOWED_MIMES.join(', ')}` 
      }, { status: 415 });
    }

    // 3. Storage
    const originalId = StorageService.generateId();
    const extension = `.${type.ext}`;
    const safePath = StorageService.getOriginalPath(originalId, extension);

    fs.writeFileSync(safePath, buffer);

    // 4. DB Injection
    const itemId = ItemService.create(file.name, safePath, type.mime, file.size);

    console.log(`[API] Uploaded ${itemId} (${file.size} bytes)`);

    return NextResponse.json({ 
      id: itemId, 
      status: 'queued',
      message: 'Upload successful, processing started.' 
    }, { status: 201 });

  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
