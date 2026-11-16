import { describe, expect, it } from 'vitest';
import en from './messages.en.json';
import hi from './messages.hi.json';
import { ISSUE_CODES, SEVERITY, issue, messageFor } from './issues';

const placeholders = (s: string): string[] => [...s.matchAll(/\{([a-z]+)\}/gu)].map((m) => m[1] ?? '').sort();
// A sentence ends with ".", "!", "?" or the Devanagari danda, followed by a space or the end.
const sentenceCount = (s: string): number => [...s.matchAll(/[.!?\u0964](?=\s|$)/gu)].length;

describe('issue codes and messages (Req 5.1, 5.2)', () => {
  it('has the fourteen codes of the design', () => {
    expect(ISSUE_CODES).toHaveLength(14);
  });

  it.each([
    ['en', en],
    ['hi', hi],
  ] as const)('%s messages cover every code and nothing else', (_lang, messages) => {
    expect(Object.keys(messages).sort()).toEqual([...ISSUE_CODES].sort());
  });

  it.each(ISSUE_CODES)('%s: plain message of at most two sentences in both languages, same placeholders', (code) => {
    const e = (en as Record<string, string>)[code] ?? '';
    const h = (hi as Record<string, string>)[code] ?? '';
    for (const m of [e, h]) {
      expect(m.trim()).not.toBe('');
      expect(sentenceCount(m)).toBeGreaterThanOrEqual(1);
      expect(sentenceCount(m)).toBeLessThanOrEqual(2);
      expect(m).not.toContain('\u2014');
    }
    expect(placeholders(h)).toEqual(placeholders(e));
  });

  it('builds issues with the severity from the table and copies params', () => {
    const params = { options: 'Band A (demo), Band B (demo)' };
    const i = issue('income-band', 'choice-unknown', params);
    expect(i).toEqual({ fieldId: 'income-band', code: 'choice-unknown', severity: 'error', params });
    expect(i.params).not.toBe(params);
    expect(issue('dob', 'date-two-digit-year')).toEqual({ fieldId: 'dob', code: 'date-two-digit-year', severity: 'warning' });
    expect(SEVERITY['photo-paste-after-print']).toBe('info');
  });

  it('fills placeholders and leaves unknown ones empty', () => {
    expect(messageFor('choice-unknown', 'en', { options: 'Yes, No' })).toBe('Please pick one of: Yes, No.');
    expect(messageFor('choice-unknown', 'hi', { options: 'हाँ, नहीं' })).toBe('कृपया इनमें से एक चुनें: हाँ, नहीं।');
    expect(messageFor('choice-unknown', 'en')).toBe('Please pick one of: .');
    expect(messageFor('required-missing', 'hi')).toBe('यह जानकारी ज़रूरी है। कृपया इसे भरें।');
  });
});
