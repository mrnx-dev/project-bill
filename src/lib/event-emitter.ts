import { EventEmitter } from "events";
import Redis from "ioredis";

// `next build` imports every route/page module to collect data. Anything that dials out at
// import time therefore runs inside the BUILDER container, which is not attached to the
// runtime network — Redis/Postgres service names do not resolve there. That produced a
// flood of `[ioredis] Unhandled error event: getaddrinfo ENOTFOUND …` during deploy.
// Guarding on the build phase keeps importing this module free of network side effects.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

// Global cache for singleton pattern in development to prevent HMR memory leaks
const globalForEvents = global as unknown as {
  _localEmitter?: EventEmitter;
  _redisPub?: Redis;
  _redisSub?: Redis;
};

// 1. Local Emitter (Fallback for self-hosted / local dev without Redis)
export const localEmitter = globalForEvents._localEmitter || new EventEmitter();

// Default 0 means no limit on listeners (to prevent Node warnings when many users connect)
localEmitter.setMaxListeners(0);

// 2. Redis instances (Only if REDIS_URL is provided) — created lazily, never at import time.
// Two clients are needed because a subscriber connection cannot publish in Redis.
function createClient(role: "pub" | "sub"): Redis | undefined {
  const url = process.env.REDIS_URL;

  // No URL, or we are only collecting build data: stay disconnected.
  if (!url || isBuildPhase) return undefined;

  const cached = role === "pub" ? globalForEvents._redisPub : globalForEvents._redisSub;
  if (cached) return cached;

  const client = new Redis(url, {
    lazyConnect: true, // do not dial until the first command is issued
    maxRetriesPerRequest: 2, // fail instead of queueing forever when Redis is unreachable
    retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2000)),
  });

  // Without an `error` listener an EventEmitter THROWS on 'error' (that is exactly the
  // "Unhandled error event" line in the deploy log). Handle and log instead.
  client.on("error", (err) => {
    console.error(`[EventEmitter] Redis ${role} error: ${err.message}`);
  });

  if (process.env.NODE_ENV !== "production") {
    if (role === "pub") globalForEvents._redisPub = client;
    else globalForEvents._redisSub = client;
  }

  return client;
}

let pubClient: Redis | undefined;
let subClient: Redis | undefined;

/** Publisher client, or undefined when Redis is not configured / we are only building. */
export function getRedisPub(): Redis | undefined {
  if (pubClient) return pubClient;
  pubClient = createClient("pub");
  return pubClient;
}

/** Subscriber client (separate connection, cannot publish). */
export function getRedisSub(): Redis | undefined {
  if (subClient) return subClient;
  subClient = createClient("sub");
  return subClient;
}

// 3. Unified Dispatcher
export async function dispatchEvent(channel: string, message: any) {
  try {
    const payload = JSON.stringify(message);
    const client = getRedisPub();

    if (client) {
      await client.publish(channel, payload);
    } else {
      localEmitter.emit(channel, payload);
    }
  } catch (err) {
    console.error(`[EventEmitter] Failed to dispatch event to ${channel}:`, err);
  }
}
