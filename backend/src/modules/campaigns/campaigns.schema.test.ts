import { describe, expect, it } from 'vitest';
import { createCampaignSchema } from './campaigns.schema';

const BASE_INPUT = {
  subject: 'Hello',
  body: '<p>Hi there</p>',
  leads: ['a@example.com', 'b@example.com'],
  startAt: '2026-09-25T10:00:00.000Z',
  delayBetweenMs: 2000,
  hourlyLimit: 50,
};

describe('createCampaignSchema', () => {
  it('accepts a well-formed campaign payload', () => {
    const result = createCampaignSchema.safeParse(BASE_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startAt).toBeInstanceOf(Date);
      expect(result.data.leads).toHaveLength(2);
    }
  });

  it('rejects an empty leads array', () => {
    const result = createCampaignSchema.safeParse({ ...BASE_INPUT, leads: [] });
    expect(result.success).toBe(false);
  });

  it('rejects malformed lead emails', () => {
    const result = createCampaignSchema.safeParse({
      ...BASE_INPUT,
      leads: ['not-an-email', 'b@example.com'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing subject', () => {
    const { subject, ...rest } = BASE_INPUT;
    const result = createCampaignSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects a negative delayBetweenMs', () => {
    const result = createCampaignSchema.safeParse({ ...BASE_INPUT, delayBetweenMs: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects a zero or negative hourlyLimit', () => {
    const result = createCampaignSchema.safeParse({ ...BASE_INPUT, hourlyLimit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects more than 50,000 leads', () => {
    const result = createCampaignSchema.safeParse({
      ...BASE_INPUT,
      leads: Array.from({ length: 50001 }, (_, i) => `lead${i}@example.com`),
    });
    expect(result.success).toBe(false);
  });

  it('coerces a numeric string delayBetweenMs', () => {
    const result = createCampaignSchema.safeParse({ ...BASE_INPUT, delayBetweenMs: '3000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.delayBetweenMs).toBe(3000);
    }
  });
});
