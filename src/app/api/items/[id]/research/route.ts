import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const allowed = ['research_location','asking_price','purchase_decision','research_notes'];
    const updates: Record<string, string> = {};
    
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }
    
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), params.id];
    
    db.prepare(`UPDATE items SET ${sets}, statusUpdatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Research PATCH] Error updating research context:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
