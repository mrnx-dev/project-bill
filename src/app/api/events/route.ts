import { NextResponse } from 'next/server';
import { localEmitter, redisSub } from '@/lib/event-emitter';

// Force dynamic and use nodejs to support EventEmitter
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  let cleanup = () => {};

  const customReadable = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial heartbeat immediately to establish connection
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Keep connection alive (important for proxies/Vercel timeouts)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 30000);

      const handleEvent = (data: any) => {
        try {
          const payload = typeof data === 'string' ? data : JSON.stringify(data);
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch (e) {
          // Stream might be closed
        }
      };

      if (redisSub) {
        const rs = redisSub;
        rs.subscribe('system_events', (err) => {
          if (err) console.error("Redis Subscribe Error:", err);
        });

        const subscriberHandler = (channel: string, message: string) => {
          if (channel === 'system_events') {
            handleEvent(message);
          }
        };

        rs.on('message', subscriberHandler);

        cleanup = () => {
          rs.off('message', subscriberHandler);
          clearInterval(heartbeat);
        };
        req.signal.addEventListener('abort', cleanup);
      } else {
        localEmitter.on('system_events', handleEvent);

        cleanup = () => {
          localEmitter.off('system_events', handleEvent);
          clearInterval(heartbeat);
        };
        req.signal.addEventListener('abort', cleanup);
      }
    },
    cancel() {
      cleanup();
    }
  });

  return new NextResponse(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
