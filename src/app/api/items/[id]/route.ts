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
      comp_search_keywords: item.comp_search_keywords ? JSON.parse(item.comp_search_keywords as string) : [],
      visible_flaws: item.visible_flaws ? JSON.parse(item.visible_flaws as string) : [],
      research_pathways: item.research_pathways ? JSON.parse(item.research_pathways as string) : [],
      uncertain_fields: item.uncertain_fields ? JSON.parse(item.uncertain_fields as string) : [],
      item_specifics: item.item_specifics ? JSON.parse(item.item_specifics as string) : {},
      identification: item.identification,
      estimated_value: item.estimated_value,
      liquidity_score: item.liquidity_score,
      target_buy_price: item.target_buy_price,
      user_decision: item.user_decision || 'none',
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
