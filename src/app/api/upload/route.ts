
import { NextRequest, NextResponse } from 'next/server';
import { createItem } from '@/lib/db/items';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';

// Disable default body parser to handle streams manually if needed, 
// but Next.js App Router handles FormData well.

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images and PDFs allowed.' }, { status: 400 });
    }
    
    if (file.size > 25 * 1024 * 1024) { // 25MB
         return NextResponse.json({ error: 'File too large. Max 25MB.' }, { status: 400 });
    }

    // Calculate Hash (for deduplication)
    const buffer = Buffer.from(await file.arrayBuffer());
    const hashSum = crypto.createHash('sha256');
    hashSum.update(buffer);
    const hexHash = hashSum.digest('hex');

    // Save File
    // We use a simplified original name storage for now
    const extension = path.extname(file.name) || '.bin';
    const storageFilename = `${crypto.randomUUID()}${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'original');
    
    // Ensure dir exists (redundant if setup script ran, but safe)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, storageFilename);
    await fs.promises.writeFile(filePath, buffer);

    // Create DB Entry
    const itemId = createItem({
      originalFilename: file.name,
      originalImagePath: filePath,
      mimeType: file.type,
      fileSize: file.size,
      originalHash: hexHash,
      contentHash: hexHash, // Initially same as original, changed after strip
    });

    return NextResponse.json({ 
      success: true, 
      id: itemId,
      message: 'File queued for processing' 
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
