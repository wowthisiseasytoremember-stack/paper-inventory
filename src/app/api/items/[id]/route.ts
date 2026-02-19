/**
 * ITEM DETAIL API
 * 
 * Handles individual item operations:
 * 1. GET: Retrieve full item details.
 * 2. PATCH: Update editable fields (validation enforced).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';

// In Next.js App Router, dynamic routes pass params as the second argument
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const item = ItemService.getById(id);

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Parse JSON for client
    const parsedItem = {
      ...item,
      identifiedNames: item.identifiedNames ? JSON.parse(item.identifiedNames) : [],
      processingLock: Boolean(item.processingLock)
    };

    return NextResponse.json(parsedItem);

  } catch (error: any) {
    console.error('Get Item Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const body = await req.json();

    // STRICT WHITELIST of editable fields
    // Users generally shouldn't edit system fields like 'originalHash' or 'status' directly via API
    // unless it's a specific 'retry' action (which might be a separate RPC-style endpoint).
    // For now, allow editing metadata.
    const editableFields = [
      'title',
      'guessedId',
      'cleanedTranscription',
      'historicalContext',
      'collectorSignificance'
    ];

    const updates: Record<string, any> = {};
    for (const field of editableFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Use ItemService to update (reusing unlock logic or creating specific update method?)
    // ItemService.unlock is for releasing locks. We need a general update method.
    // Let's allow ItemService.unlock to be used IF we are not changing status?
    // Or better, add a specific update method to ItemService.
    
    // For now, let's just do a direct DB update here or extend ItemService inline.
    // Extending ItemService is cleaner. I will add ItemService.updateMetadata() logic here for now
    // to stick to the pattern of "Service Layer handles DB".
    
    // Actually, let's use the DB directly for simplicity in this endpoint 
    // BUT respecting the Architecture rules of "DB is Truth".
    
    const sets = Object.keys(updates).map(k => `${k} = ?`);
    const args = [...Object.values(updates), id];
    
    const { db } = await import('@/lib/db'); // dynamic import or strictly from lib
    db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...args);

    return NextResponse.json({ success: true, updates });

  } catch (error: any) {
    console.error('Update Item Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
