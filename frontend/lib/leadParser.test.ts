import { describe, expect, it } from 'vitest';
import { parseLeads } from './leadParser';

describe('parseLeads', () => {
  it('accepts well-formed emails and lowercases/trims them', () => {
    const result = parseLeads([' A@Example.com ', 'b@example.com']);
    expect(result.valid).toEqual(['a@example.com', 'b@example.com']);
    expect(result.invalidCount).toBe(0);
    expect(result.duplicateCount).toBe(0);
  });

  it('skips blank rows silently (no count impact)', () => {
    const result = parseLeads(['', '   ', 'a@example.com']);
    expect(result.valid).toEqual(['a@example.com']);
    expect(result.invalidCount).toBe(0);
  });

  it('counts malformed entries as invalid', () => {
    const result = parseLeads(['not-an-email', 'also bad', 'a@example.com']);
    expect(result.valid).toEqual(['a@example.com']);
    expect(result.invalidCount).toBe(2);
  });

  it('counts case-insensitive duplicates and keeps only the first occurrence', () => {
    const result = parseLeads(['a@example.com', 'A@Example.com', 'b@example.com']);
    expect(result.valid).toEqual(['a@example.com', 'b@example.com']);
    expect(result.duplicateCount).toBe(1);
  });

  it('handles a realistic mixed CSV column dump', () => {
    const result = parseLeads([
      'a@example.com',
      'A@EXAMPLE.COM',
      'not-valid',
      '',
      'c@example.com',
      'c@example.com',
    ]);
    expect(result.valid).toEqual(['a@example.com', 'c@example.com']);
    expect(result.invalidCount).toBe(1);
    expect(result.duplicateCount).toBe(2);
  });
});
