import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    console.log('[Admin API] Wiping vault history and files...');

    // 1. Clear database tables
    // We wrap in a transaction for safety
    db.transaction(() => {
      db.prepare('DELETE FROM items').run();
      // Add other tables if they exist (e.g., items_fts)
      try {
        db.prepare('DELETE FROM items_fts').run();
      } catch (e) {
        // Table might not exist yet if FTS isn't initialized
      }
    })();

    // 2. Clear upload directories
    const uploadDirs = ['public/uploads', 'public/uploads/thumbnails', 'public/uploads/resized'];
    
    for (const dir of uploadDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
          const filePath = path.join(fullPath, file);
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }
      }
    }

    console.log('[Admin API] Vault wiped successfully.');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin API] Wipe Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
