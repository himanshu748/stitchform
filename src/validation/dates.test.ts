import { describe, expect, it } from 'vitest';
import {
  DATE_FORMATS,
  canonicalDate,
  compareDates,
  formatDate,
  isValidCalendarDate,
  parseDate,
  type CalendarDate,
  type DateFormat,
} from './dates';

const today: CalendarDate = { y: 2026, m: 11, d: 16 };
const other = { role: 'other' as const, today };
const march5: CalendarDate = { y: 2004, m: 3, d: 5 };

describe('formatDate (Req 1.8)', () => {
  it.each([
    ['DD/MM/YYYY', '05/03/2004'],
    ['D/M/YYYY', '5/3/2004'],
    ['DD-MM-YYYY', '05-03-2004'],
    ['DD.MM.YYYY', '05.03.2004'],
    ['D-M-YY', '5-3-04'],
    ['YYYY-MM-DD', '2004-03-05'],
  ] as [DateFormat, string][])('%s gives %s', (f, expected) => {
    expect(formatDate(march5, f)).toBe(expected);
  });

  it('writes Devanagari digits on request', () => {
    expect(formatDate(march5, 'DD/MM/YYYY', 'devanagari')).toBe('०५/०३/२००४');
    expect(formatDate({ y: 1999, m: 12, d: 31 }, 'D-M-YY', 'devanagari')).toBe('३१-१२-९९');
  });

  it('lists all six supported formats', () => {
    expect([...DATE_FORMATS].sort()).toEqual(['D-M-YY', 'D/M/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']);
  });

  it('canonical form is DD/MM/YYYY with ASCII digits', () => {
    expect(canonicalDate({ y: 2026, m: 1, d: 9 })).toBe('09/01/2026');
  });
});

describe('isValidCalendarDate (Req 1.5)', () => {
  it.each([
    [{ y: 2004, m: 2, d: 29 }, true],
    [{ y: 2000, m: 2, d: 29 }, true],
    [{ y: 2003, m: 2, d: 29 }, false],
    [{ y: 1900, m: 2, d: 29 }, false],
    [{ y: 2004, m: 2, d: 30 }, false],
    [{ y: 2004, m: 4, d: 31 }, false],
    [{ y: 2004, m: 12, d: 31 }, true],
    [{ y: 2004, m: 13, d: 1 }, false],
    [{ y: 2004, m: 0, d: 1 }, false],
    [{ y: 2004, m: 1, d: 0 }, false],
    [{ y: 0, m: 1, d: 1 }, false],
    [{ y: 2004.5, m: 1, d: 1 }, false],
  ])('%j is %s', (date, expected) => {
    expect(isValidCalendarDate(date)).toBe(expected);
  });
});

describe('compareDates', () => {
  it('orders by year, month, then day', () => {
    expect(compareDates(march5, march5)).toBe(0);
    expect(compareDates(march5, { y: 2004, m: 3, d: 6 })).toBeLessThan(0);
    expect(compareDates({ y: 2005, m: 1, d: 1 }, march5)).toBeGreaterThan(0);
  });
});

describe('parseDate, numeric formats (Req 1.1, 1.2, 1.4, 1.5, 1.7)', () => {
  it.each([
    '05/03/2004',
    '5/3/2004',
    '05-03-2004',
    '05.03.2004',
    '2004-03-05',
    ' 05 / 03 / 2004 ',
    '०५/०३/२००४',
    '२००४-०३-०५',
  ])('reads %j as 5 March 2004, day first', (text) => {
    expect(parseDate(text, other)).toEqual({ ok: true, date: march5, twoDigitYear: false });
  });

  it('marks a two-digit year', () => {
    expect(parseDate('5-3-04', other)).toEqual({ ok: true, date: march5, twoDigitYear: true });
    expect(parseDate('५-३-०४', other)).toEqual({ ok: true, date: march5, twoDigitYear: true });
  });

  it('parses a canonical value back to the same date (Req 1.4)', () => {
    const d = { y: 1987, m: 11, d: 23 };
    expect(parseDate(canonicalDate(d), other)).toEqual({ ok: true, date: d, twoDigitYear: false });
  });

  it.each(['31/02/2004', '29/02/2003', '29/02/1900', '00/01/2004', '12/13/2004', '2004-02-30', '01/01/0000'])(
    'rejects %j as date-impossible instead of moving it to another day',
    (text) => {
      expect(parseDate(text, other)).toEqual({ ok: false, code: 'date-impossible' });
    },
  );

  it('accepts 29 February in leap years', () => {
    expect(parseDate('29/02/2000', other)).toEqual({ ok: true, date: { y: 2000, m: 2, d: 29 }, twoDigitYear: false });
  });

  it.each(['', '   ', '05/03-2004', '05.03/2004', '2004/03/05', '5/3', '005/03/2004', '05/03/20045', 'tomorrow', '5th', '05/03/204'])(
    'rejects %j as date-unparsed',
    (text) => {
      expect(parseDate(text, other)).toEqual({ ok: false, code: 'date-unparsed' });
    },
  );

  it('rejects very long input before parsing', () => {
    expect(parseDate(`05/03/2004${' '.repeat(300)}`, other)).toEqual({ ok: false, code: 'date-unparsed' });
  });
});
