import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected',
    storage: 'ok',
    queue: 0,
    errors: 0
  };

  try {
    // Check DB
    const count = db.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number };
    
    // Check Queue
    const pending = db.prepare("SELECT COUNT(*) as count FROM items WHERE status NOT IN ('complete', 'error')").get() as { count: number };
    health.queue = pending.count;

    // Check Errors
    const errors = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'error'").get() as { count: number };
    health.errors = errors.count;

    // Check Storage
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'original');
    if (!fs.existsSync(uploadDir)) {
      health.storage = 'missing_directory';
      health.status = 'warning';
    }

    return NextResponse.json(health);
  } catch (err) {
    return NextResponse.json({ 
      status: 'error', 
      message: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}
