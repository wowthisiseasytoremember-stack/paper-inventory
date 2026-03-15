import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  console.log('[Admin API] INITIALIZING GLOBAL VAULT PURGE...');
  
  try {
    // 1. Clear database tables with individual try/catch for granular error reporting
    const tables = ['items', 'collections'];
    
    for (const table of tables) {
      try {
        console.log(`[Admin API] Deleting all records from ${table}...`);
        db.prepare(`DELETE FROM ${table}`).run();
      } catch (dbErr: any) {
        console.error(`[Admin API] Failed to clear table ${table}:`, dbErr.message);
        // We continue to try clearing other things even if one table fails
      }
    }

    // 2. Clear upload directories
    const uploadDirs = [
      'public/uploads/original', 
      'public/uploads/thumbnails', 
      'public/uploads/resized',
      'data/resized'
    ];
    
    let deletedCount = 0;
    let failCount = 0;

    for (const dir of uploadDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
          const filePath = path.join(fullPath, file);
          try {
            if (fs.lstatSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          } catch (e: any) {
            console.warn(`[Admin API] Could not delete file ${file}:`, e.message);
            failCount++;
          }
        }
      }
    }

    console.log(`[Admin API] Purge complete. Files deleted: ${deletedCount}, Failed: ${failCount}`);
    return NextResponse.json({ 
        success: true, 
        stats: { deletedFiles: deletedCount, failedDeletes: failCount } 
    });

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Admin API] CRITICAL PURGE ERROR:', errorMsg);
    return NextResponse.json({ 
      error: 'Vault purge failed', 
      details: errorMsg 
    }, { status: 500 });
  }
}
