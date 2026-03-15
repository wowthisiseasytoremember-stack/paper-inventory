import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const pushUpdate = () => {
        const item = ItemService.getById(id);
        if (!item) return false;

        controller.enqueue(encoder.encode(`event: itemUpdate\ndata: ${JSON.stringify(item)}\n\n`));

        return item.status !== 'complete' && item.status !== 'error';
      };

      // Initial push
      pushUpdate();

      // Poll every 1 second; stop when item is done
      const interval = setInterval(() => {
        const active = pushUpdate();
        if (!active) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
