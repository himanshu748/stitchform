import { describe, expect, it } from 'vitest';
import { parseDate, type CalendarDate } from './dates';
import { HINDI_NUMBER_WORDS, foldDevanagari, parseHindiNumber } from './hindi-numbers';
import { MONTH_NAMES, monthFromName } from './months';

const today: CalendarDate = { y: 2026, m: 11, d: 16 };
const other = { role: 'other' as const, today };
const march5 = { y: 2004, m: 3, d: 5 };

describe('Hindi number words 0 to 99', () => {
  it('has one entry per number and no key shared by two numbers', () => {
    expect(HINDI_NUMBER_WORDS).toHaveLength(100);
    const owner = new Map<string, number>();
    HINDI_NUMBER_WORDS.forEach((words, n) => {
      expect(words.length, `no word for ${n}`).toBeGreaterThan(0);
      for (const w of words) {
        const key = foldDevanagari(w);
        expect(owner.get(key) ?? n, `${w} is listed for ${owner.get(key)} and ${n}`).toBe(n);
        owner.set(key, n);
      }
    });
  });

  it.each([
    ['शून्य', 0],
    ['पाँच', 5],
    ['पांच', 5],
    ['उन्नीस', 19],
    ['इकतीस', 31],
    ['अड़तीस', 38],
    ['अडतीस', 38],
    ['निन्यानवे', 99],
  ] as const)('%s is %i', (word, n) => {
    expect(parseHindiNumber(word)).toBe(n);
  });

  it('returns null for anything else', () => {
    expect(parseHindiNumber('सौ')).toBeNull();
    expect(parseHindiNumber('five')).toBeNull();
    expect(parseHindiNumber('')).toBeNull();
  });
});

describe('month names', () => {
  it('lists twelve months', () => {
    expect(MONTH_NAMES).toHaveLength(12);
  });

  it.each([
    ['March', 3],
    ['mar', 3],
    ['Mar.', 3],
    ['SEPT', 9],
    ['may', 5],
    ['मार्च', 3],
    ['फ़रवरी', 2],
    ['फरवरी', 2],
    ['सितम्बर', 9],
    ['दिसंबर', 12],
  ] as const)('%s is month %i', (name, m) => {
    expect(monthFromName(name)).toBe(m);
  });

  it('returns null for a non-month', () => {
    expect(monthFromName('marchy')).toBeNull();
    expect(monthFromName('')).toBeNull();
  });
});

describe('parseDate, spoken and written word dates (Req 1.3)', () => {
  it.each([
    '5 March 2004',
    'March 5, 2004',
    '5 मार्च 2004',
    'पाँच मार्च दो हज़ार चार',
    'पांच मार्च दो हजार चार',
    '5th March 2004',
    '5th of March, 2004',
    'march 5th 2004',
    'Mar. 5, 2004',
    '५ मार्च २००४',
    'पाँच मार्च, सन दो हज़ार चार',
    'मार्च पाँच दो हज़ार चार',
    'पाँच मार्च 2004',
    '5 मार्च दो हज़ार 4',
  ])('reads %j as 5 March 2004', (text) => {
    expect(parseDate(text, other)).toEqual({ ok: true, date: march5, twoDigitYear: false });
  });

  it.each([
    ['बीस अगस्त उन्नीस सौ निन्यानवे', { y: 1999, m: 8, d: 20 }],
    ['इकतीस दिसंबर उन्नीस सौ', { y: 1900, m: 12, d: 31 }],
    ['एक जनवरी दो हज़ार', { y: 2000, m: 1, d: 1 }],
    ['1 January 1950', { y: 1950, m: 1, d: 1 }],
    ['September 30, 2026', { y: 2026, m: 9, d: 30 }],
  ] as const)('reads %j', (text, date) => {
    expect(parseDate(text, other)).toEqual({ ok: true, date, twoDigitYear: false });
  });

  it('applies the two-digit-year pivot to word dates', () => {
    expect(parseDate('5 March 04', other)).toEqual({ ok: true, date: march5, twoDigitYear: true });
    expect(parseDate('5 March 27', { role: 'dob', today })).toEqual({
      ok: true,
      date: { y: 1927, m: 3, d: 5 },
      twoDigitYear: true,
    });
  });

  it.each(['31 February 2004', 'उनतीस फ़रवरी दो हज़ार तीन', '32 March 2004', 'शून्य मार्च 2004', '0 March 2004'])(
    'rejects %j as date-impossible',
    (text) => {
      expect(parseDate(text, other)).toEqual({ ok: false, code: 'date-impossible' });
    },
  );

  it.each([
    'March 2004',
    '5 March',
    'March',
    '5 March 2004 extra',
    '5 March May 2004',
    'उन्नीस सौ',
    'पाँच मार्च उन्नीस सौ शून्य',
    'पाँच मार्च दस हज़ार',
    'five March 2004',
    '5 Marchy 2004',
    'yesterday',
  ])('rejects %j as date-unparsed', (text) => {
    expect(parseDate(text, other)).toEqual({ ok: false, code: 'date-unparsed' });
  });
});
