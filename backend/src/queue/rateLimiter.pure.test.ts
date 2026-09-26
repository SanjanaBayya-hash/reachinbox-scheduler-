import { describe, expect, it } from 'vitest';
import { computeNextWindowSlot, hourKeyFor, nextHourBoundary } from './rateLimiter';

describe('hourKeyFor', () => {
  it('formats a UTC timestamp as YYYYMMDDHH', () => {
    const date = new Date(Date.UTC(2026, 8, 25, 14, 37, 12));
    expect(hourKeyFor(date)).toBe('2026092514');
  });

  it('pads single-digit month/day/hour with zeros', () => {
    const date = new Date(Date.UTC(2026, 0, 5, 3, 0, 0));
    expect(hourKeyFor(date)).toBe('2026010503');
  });
});

describe('nextHourBoundary', () => {
  it('rounds up to the top of the next UTC hour', () => {
    const date = new Date(Date.UTC(2026, 8, 25, 14, 37, 12));
    const next = nextHourBoundary(date);
    expect(next.toISOString()).toBe('2026-09-25T15:00:00.000Z');
  });

  it('rolls over into the next day at the 23:00 boundary', () => {
    const date = new Date(Date.UTC(2026, 8, 25, 23, 5, 0));
    const next = nextHourBoundary(date);
    expect(next.toISOString()).toBe('2026-09-26T00:00:00.000Z');
  });
});

describe('computeNextWindowSlot', () => {
  const now = new Date(Date.UTC(2026, 8, 25, 14, 37, 0));

  it('spreads rescheduled jobs across the next hour using seq % limit', () => {
    const limit = 50;
    const delayBetweenMs = 2000;

    const slotForSeq0 = computeNextWindowSlot(0, limit, delayBetweenMs, now);
    const slotForSeq1 = computeNextWindowSlot(1, limit, delayBetweenMs, now);
    const slotForSeq49 = computeNextWindowSlot(49, limit, delayBetweenMs, now);

    expect(slotForSeq0.toISOString()).toBe('2026-09-25T15:00:00.000Z');
    expect(slotForSeq1.getTime() - slotForSeq0.getTime()).toBe(delayBetweenMs);
    expect(slotForSeq49.getTime() - slotForSeq0.getTime()).toBe(49 * delayBetweenMs);
  });

  it('wraps seq back to the start of the window once it exceeds the limit', () => {
    const limit = 50;
    const delayBetweenMs = 2000;

    const slotForSeq0 = computeNextWindowSlot(0, limit, delayBetweenMs, now);
    const slotForSeq50 = computeNextWindowSlot(50, limit, delayBetweenMs, now);

    expect(slotForSeq50.getTime()).toBe(slotForSeq0.getTime());
  });

  it('keeps relative order intact within a single window', () => {
    const limit = 10;
    const delayBetweenMs = 500;
    const slots = Array.from({ length: 10 }, (_, seq) =>
      computeNextWindowSlot(seq, limit, delayBetweenMs, now).getTime(),
    );
    const sorted = [...slots].sort((a, b) => a - b);
    expect(slots).toEqual(sorted);
  });
});
