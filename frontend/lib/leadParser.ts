export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedLeads {
  valid: string[];
  invalidCount: number;
  duplicateCount: number;
}

export function parseLeads(raw: string[]): ParsedLeads {
  const seen = new Set<string>();
  const valid: string[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const entry of raw) {
    const candidate = entry.trim().toLowerCase();
    if (!candidate) continue;
    if (!EMAIL_REGEX.test(candidate)) {
      invalidCount += 1;
      continue;
    }
    if (seen.has(candidate)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(candidate);
    valid.push(candidate);
  }

  return { valid, invalidCount, duplicateCount };
}
