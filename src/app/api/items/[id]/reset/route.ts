/**
 * RESET API
 *
 * Re-queues a stuck item that is not in error state.
 * Intended for stalled processing recovery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const item = ItemService.getById(id);

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.status === 'error') {
      return NextResponse.json({ 
        error: "Item is in 'error' state. Use retry instead."
      }, { status: 400 });
    }

    if (item.retryCount >= 3) {
      return NextResponse.json({ 
        error: 'Max retries exceeded (3). Manual intervention required.' 
      }, { status: 422 });
    }

    db.prepare(`
      UPDATE items
      SET status = 'queued',
          errorMessage = NULL,
          processingLock = 0,
          watchdogLockedAt = NULL,
          retryCount = retryCount + 1,
          statusUpdatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    console.log(`[Reset] Re-queued stalled item ${id}`);

    return NextResponse.json({
      success: true,
      id,
      message: 'Item re-queued for processing.'
    });
  } catch (error: any) {
    console.error('Reset Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
