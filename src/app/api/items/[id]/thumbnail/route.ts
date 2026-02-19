/**
 * THUMBNAIL SERVING API
 * 
 * Serves the generated thumbnail for an item.
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

    if (!item || !item.thumbnailPath) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    if (!fs.existsSync(item.thumbnailPath)) {
        return NextResponse.json({ error: 'File missing on disk' }, { status: 410 });
    }

    const fileBuffer = fs.readFileSync(item.thumbnailPath);
    const mimeType = mime.getType(item.thumbnailPath) || 'image/jpeg';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    console.error('Serve Thumbnail Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
