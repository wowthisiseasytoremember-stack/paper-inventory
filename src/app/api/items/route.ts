import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = db.prepare(`
      SELECT 
        id, 
        status, 
        originalFilename, 
        title, 
        thumbnailPath, 
        confidence, 
        createdAt 
      FROM items 
      ORDER BY createdAt DESC 
      LIMIT 50
    `).all();

    return NextResponse.json(items);
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
