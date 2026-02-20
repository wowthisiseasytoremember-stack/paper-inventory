/**
 * RETRY API
 * 
 * Re-queues a failed item for processing.
 * Resets error state and increments retry count.
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

    if (item.status !== 'error') {
      return NextResponse.json({ 
        error: `Cannot retry item in '${item.status}' state. Only 'error' items can be retried.` 
      }, { status: 400 });
    }

    if (item.retryCount >= 3) {
      return NextResponse.json({ 
        error: 'Max retries exceeded (3). Manual intervention required.' 
      }, { status: 422 });
    }

    // Reset to queued with incremented retry count
    db.prepare(`
      UPDATE items 
      SET status = 'queued', 
          errorMessage = NULL, 
          processingLock = 0, 
          watchdogLockedAt = NULL,
          retryCount = retryCount + 1
      WHERE id = ?
    `).run(id);

    console.log(`[Retry] Re-queued item ${id} (attempt ${item.retryCount + 1})`);

    return NextResponse.json({ 
      success: true, 
      id,
      retryCount: item.retryCount + 1,
      message: 'Item re-queued for processing.'
    });

  } catch (error: any) {
    console.error('Retry Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
