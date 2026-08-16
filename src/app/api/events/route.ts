import { NextResponse } from 'next/server';
import { localEmitter, redisSub } from '@/lib/event-emitter';
import { withTenant, getTenantCtx } from '@/lib/rls';

// Force dynamic and use nodejs to support EventEmitter
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withTenant(async (req: Request) => {
  const ctx = getTenantCtx()!;
  const orgId = ctx.organizationId;
  let cleanup = () => {};

  // Only forward events whose payload belongs to this tenant.
  const isRelevant = (raw: string): boolean => {
    try {
      const parsed = JSON.parse(raw);
      const data = parsed?.data ?? parsed;
      return data?.organizationId === orgId;
    } catch {
      return false;
    }
  };

  const customReadable = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      controller.enqueue(encoder.encode(': connected\n\n'));

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
          if (!isRelevant(payload)) return;
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
});
