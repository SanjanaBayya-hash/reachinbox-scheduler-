import type { Redis } from 'ioredis';
import { redis } from './redis';

const HOURLY_TTL_SECONDS = 2 * 60 * 60;

/**
 * Atomically increments the hourly counter and self-refunds if it pushes past the
 * limit, so the stored count always reflects accepted sends only.
 */
const HOURLY_INCR_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1
`;

/**
 * Atomically reserves the next send slot for a sender if the minimum gap has
 * elapsed. Returns 1 (reserved) or the epoch-ms timestamp of the next free slot.
 */
const RESERVE_SLOT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minGapMs = tonumber(ARGV[2])
local nextSlot = tonumber(redis.call('GET', key) or '0')
if now >= nextSlot then
  redis.call('SET', key, now + minGapMs, 'PX', 24 * 60 * 60 * 1000)
  return 1
end
return nextSlot
`;

declare module 'ioredis' {
  interface RedisCommander<Context> {
    hourlyIncr(key: string, limit: number, ttlSeconds: number): Promise<number>;
    reserveSlot(key: string, now: number, minGapMs: number): Promise<number>;
  }
}

(redis as Redis).defineCommand('hourlyIncr', {
  numberOfKeys: 1,
  lua: HOURLY_INCR_SCRIPT,
});

(redis as Redis).defineCommand('reserveSlot', {
  numberOfKeys: 1,
  lua: RESERVE_SLOT_SCRIPT,
});

export function hourKeyFor(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}${m}${d}${h}`;
}

export function nextHourBoundary(date: Date): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

/**
 * When an hourly limit is hit, rescheduled jobs keep their relative send order
 * and spread across the next hour instead of all landing on the same second.
 */
export function computeNextWindowSlot(
  seq: number,
  effectiveHourlyLimit: number,
  delayBetweenMs: number,
  now: Date = new Date(),
): Date {
  const nextWindowStart = nextHourBoundary(now);
  const offsetInWindow = (seq % effectiveHourlyLimit) * delayBetweenMs;
  return new Date(nextWindowStart.getTime() + offsetInWindow);
}

export async function tryIncrHourlyCounter(
  senderId: string,
  limit: number,
  at: Date = new Date(),
): Promise<{ allowed: boolean; hourKey: string }> {
  const hourKey = hourKeyFor(at);
  const allowed = (await redis.hourlyIncr(`rl:${senderId}:${hourKey}`, limit, HOURLY_TTL_SECONDS)) === 1;
  return { allowed, hourKey };
}

export async function refundHourlyCounter(senderId: string, hourKey: string): Promise<void> {
  await redis.decr(`rl:${senderId}:${hourKey}`);
}

export async function tryReserveSendSlot(
  senderId: string,
  minGapMs: number,
): Promise<{ allowed: boolean; nextAvailableAt: Date }> {
  const now = Date.now();
  const result = await redis.reserveSlot(`sender:${senderId}:nextSlot`, now, minGapMs);
  if (result === 1) {
    return { allowed: true, nextAvailableAt: new Date(now) };
  }
  return { allowed: false, nextAvailableAt: new Date(result) };
}
