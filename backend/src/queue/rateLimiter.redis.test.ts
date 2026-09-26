/**
 * Exercises the actual Lua scripts against a real Redis instance (the Docker
 * `redis` service — no mocking, since the whole point is atomicity under
 * concurrent access). Run `docker compose up -d redis` before `npm test`.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { redis } from './redis';
import { refundHourlyCounter, tryIncrHourlyCounter, tryReserveSendSlot } from './rateLimiter';

const TEST_SENDER = 'test-sender-rate-limiter';

async function cleanup() {
  const keys = await redis.keys(`rl:${TEST_SENDER}:*`);
  const slotKeys = await redis.keys(`sender:${TEST_SENDER}:*`);
  if (keys.length || slotKeys.length) {
    await redis.del(...keys, ...slotKeys);
  }
}

afterAll(async () => {
  await cleanup();
  await redis.quit();
});

describe('tryIncrHourlyCounter (Lua)', () => {
  beforeEach(cleanup);

  it('allows sends until the limit, then blocks', async () => {
    const limit = 3;
    const results: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const { allowed } = await tryIncrHourlyCounter(TEST_SENDER, limit);
      results.push(allowed);
    }
    expect(results).toEqual([true, true, true, false, false]);
  });

  it('does not let the counter creep past the limit on repeated over-limit calls', async () => {
    const limit = 2;
    for (let i = 0; i < 5; i++) {
      await tryIncrHourlyCounter(TEST_SENDER, limit);
    }
    const count = await redis.get(`rl:${TEST_SENDER}:${(await tryIncrHourlyCounter(TEST_SENDER, limit)).hourKey}`);
    expect(Number(count)).toBeLessThanOrEqual(limit + 1);
  });

  it('refunding decrements the counter, freeing a slot', async () => {
    const limit = 1;
    const first = await tryIncrHourlyCounter(TEST_SENDER, limit);
    expect(first.allowed).toBe(true);

    const blocked = await tryIncrHourlyCounter(TEST_SENDER, limit);
    expect(blocked.allowed).toBe(false);

    await refundHourlyCounter(TEST_SENDER, first.hourKey);

    const afterRefund = await tryIncrHourlyCounter(TEST_SENDER, limit);
    expect(afterRefund.allowed).toBe(true);
  });

  it('concurrent increments never exceed the limit (atomicity check)', async () => {
    const limit = 10;
    const attempts = 30;
    const outcomes = await Promise.all(
      Array.from({ length: attempts }, () => tryIncrHourlyCounter(TEST_SENDER, limit)),
    );
    const allowedCount = outcomes.filter((o) => o.allowed).length;
    expect(allowedCount).toBe(limit);
  });
});

describe('tryReserveSendSlot (Lua)', () => {
  beforeEach(cleanup);

  it('reserves the first slot immediately', async () => {
    const { allowed } = await tryReserveSendSlot(TEST_SENDER, 2000);
    expect(allowed).toBe(true);
  });

  it('blocks a second reservation before the gap elapses', async () => {
    await tryReserveSendSlot(TEST_SENDER, 5000);
    const second = await tryReserveSendSlot(TEST_SENDER, 5000);
    expect(second.allowed).toBe(false);
    expect(second.nextAvailableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('concurrent reservations only let one caller through per gap window', async () => {
    const minGapMs = 60_000; // long enough that only the first of 10 concurrent calls wins
    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => tryReserveSendSlot(TEST_SENDER, minGapMs)),
    );
    const allowedCount = outcomes.filter((o) => o.allowed).length;
    expect(allowedCount).toBe(1);
  });
});
