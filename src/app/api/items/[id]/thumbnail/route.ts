/**
 * THUMBNAIL SERVING API
 * 
 * Serves the generated thumbnail for an item.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';
import fs from 'fs';
import path from 'path';
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

    const thumbnailPath = item.thumbnailPath;
    if (!thumbnailPath) {
        return NextResponse.json({ error: 'Thumbnail file not found' }, { status: 404 });
    }

    // Resolve absolute path
    const absolutePath = path.isAbsolute(thumbnailPath)
      ? thumbnailPath
      : path.join(process.cwd(), 'public', thumbnailPath.replace(/^\//, ''));

    if (!fs.existsSync(absolutePath)) {
        return NextResponse.json({ error: 'File missing on disk' }, { status: 410 });
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const mimeType = mime.getType(absolutePath) || 'image/jpeg';

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
