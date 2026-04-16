import { EventEmitter } from "events";
import Redis from "ioredis";

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

// 2. Redis instances (Only if REDIS_URL is provided)
// We need two instances because a subscriber client cannot publish in Redis
export const redisPub = process.env.REDIS_URL
  ? globalForEvents._redisPub || new Redis(process.env.REDIS_URL)
  : undefined;

export const redisSub = process.env.REDIS_URL
  ? globalForEvents._redisSub || new Redis(process.env.REDIS_URL)
  : undefined;

if (process.env.NODE_ENV !== "production") {
  globalForEvents._localEmitter = localEmitter;
  globalForEvents._redisPub = redisPub;
  globalForEvents._redisSub = redisSub;
}

// 3. Unified Dispatcher
export async function dispatchEvent(channel: string, message: any) {
  try {
    const payload = JSON.stringify(message);
    
    if (redisPub) {
      await redisPub.publish(channel, payload);
    } else {
      localEmitter.emit(channel, payload);
    }
  } catch (err) {
    console.error(`[EventEmitter] Failed to dispatch event to ${channel}:`, err);
  }
}
