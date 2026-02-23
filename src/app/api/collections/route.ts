import { NextRequest, NextResponse } from 'next/server';
import { CollectionService } from '@/lib/db/collection';

export async function GET() {
  try {
    const collections = CollectionService.getAll();
    return NextResponse.json(collections);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, icon } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const id = CollectionService.create(name, description, icon);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
