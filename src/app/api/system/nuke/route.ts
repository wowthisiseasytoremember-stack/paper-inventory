import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    console.log('[System] Initiating Archive Nuke...');

    // 1. Delete all records from the database
    db.prepare('DELETE FROM items').run();
    db.prepare('DELETE FROM items_fts').run(); // Clear search index

    // 2. Clear upload directories
    const DIRS = [
      path.join(process.cwd(), 'public', 'uploads', 'original'),
      path.join(process.cwd(), 'public', 'uploads', 'resized'),
      path.join(process.cwd(), 'public', 'uploads', 'thumbnails'),
    ];

    for (const dir of DIRS) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file !== '.gitkeep') {
             fs.unlinkSync(path.join(dir, file));
          }
        }
      }
    }

    console.log('[System] Nuke Complete. All data erased.');
    return NextResponse.json({ success: true, message: 'Archive completely erased.' });

  } catch (error: any) {
    console.error('[System] Nuke Failed:', error);
    return NextResponse.json({ error: 'Failed to erase archive', details: error.message }, { status: 500 });
  }
}
