/**
 * ORIGINAL IMAGE SERVING API
 * 
 * Serves the original (or resized) image for deep inspection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';
import fs from 'fs';
import mime from 'mime';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const item = ItemService.getById(id);

    if (!item || !item.originalImagePath) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Prefer resized image for web display if available? 
    // Usually yes, but user might want "Original". 
    // Let's assume this endpoint is for the detailed view, so resized is better for performance 
    // unless they specifically request download.
    // Let's serve resized if available, else original.
    const pathToSend = item.resizedImagePath || item.originalImagePath;

    if (!fs.existsSync(pathToSend)) {
        return NextResponse.json({ error: 'File missing on disk' }, { status: 410 });
    }

    const fileBuffer = fs.readFileSync(pathToSend);
    const mimeType = mime.getType(pathToSend) || item.mimeType || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    console.error('Serve Image Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
