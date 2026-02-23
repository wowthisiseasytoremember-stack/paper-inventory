import { NextRequest, NextResponse } from 'next/server';
import { CollectionService } from '@/lib/db/collection';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const items = CollectionService.getItems(id);
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
