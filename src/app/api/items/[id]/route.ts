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

    // Parse JSON fields for client
    const parsedItem = {
      ...item,
      identifiedNames: item.identifiedNames ? JSON.parse(item.identifiedNames) : [],
      tags: item.tags ? JSON.parse(item.tags as string) : [],
      verification_questions: item.verification_questions ? JSON.parse(item.verification_questions) : [],
      analysis_history: item.analysis_history ? JSON.parse(item.analysis_history) : [],
      lockedFields: (item as any).lockedFields ? JSON.parse((item as any).lockedFields) : [],
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

    // Validate item exists
    const item = ItemService.getById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Auto-lock user-edited fields so AI won't overwrite them
    const LOCKABLE = ['title', 'cleanedTranscription', 'historicalContext', 'collectorSignificance', 'valuation', 'tags'];
    const editedFields = Object.keys(body).filter(k => LOCKABLE.includes(k));

    if (editedFields.length > 0) {
      const existing: string[] = (item as any).lockedFields
        ? JSON.parse((item as any).lockedFields)
        : [];
      const merged = [...new Set([...existing, ...editedFields])];
      body.lockedFields = JSON.stringify(merged);
    }

    const result = ItemService.updateMetadata(id, body);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    return NextResponse.json({ success: true, changes: result.changes });

  } catch (error: any) {
    console.error('Update Item Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
