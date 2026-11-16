import { describe, expect, it } from 'vitest';
import {
  DATE_FORMATS,
  ageOn,
  canonicalDate,
  checkDateOfBirth,
  compareDates,
  formatDate,
  isValidCalendarDate,
  parseDate,
  resolveTwoDigitYear,
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

describe('two-digit-year pivot (Req 1.6)', () => {
  const dob = { role: 'dob' as const, today };

  it.each([
    // [text, role, expected year]
    ['5-3-04', 'other', 2004],
    ['5-3-99', 'other', 2099],
    ['5-3-04', 'dob', 2004],
    ['5-3-26', 'dob', 2026],
    ['5-3-27', 'dob', 1927],
    ['5-3-99', 'dob', 1999],
    ['5-3-00', 'dob', 2000],
    // Same two digits as this year, but after today: the previous century.
    ['20-12-26', 'dob', 1926],
    // Exactly today is not in the future.
    ['16-11-26', 'dob', 2026],
  ] as const)('%s as %s gives year %i', (text, role, year) => {
    const r = parseDate(text, { role, today });
    expect(r.ok && r.date.y).toBe(year);
    expect(r.ok && r.twoDigitYear).toBe(true);
  });

  it('applies to every day-first separator and to Devanagari digits', () => {
    for (const text of ['5/3/27', '5.3.27', '५-३-२७']) {
      expect(parseDate(text, dob)).toEqual({ ok: true, date: { y: 1927, m: 3, d: 5 }, twoDigitYear: true });
    }
  });

  it('still rejects an impossible date after resolving the year', () => {
    // 2025 and 1925 are not leap years.
    expect(parseDate('29-2-25', dob)).toEqual({ ok: false, code: 'date-impossible' });
    expect(parseDate('29-2-24', dob)).toEqual({ ok: true, date: { y: 2024, m: 2, d: 29 }, twoDigitYear: true });
  });

  it('resolveTwoDigitYear depends only on its inputs, not the clock (Req 2.3)', () => {
    const at2050 = { y: 2050, m: 1, d: 1 };
    expect(resolveTwoDigitYear(49, { role: 'dob', today: at2050, m: 6, d: 1 })).toBe(2049);
    expect(resolveTwoDigitYear(50, { role: 'dob', today: at2050, m: 6, d: 1 })).toBe(1950);
    expect(resolveTwoDigitYear(50, { role: 'dob', today: at2050, m: 1, d: 1 })).toBe(2050);
    expect(resolveTwoDigitYear(50, { role: 'other', today: at2050, m: 6, d: 1 })).toBe(2050);
  });
});

describe('date of birth plausibility (Req 2.1, 2.2, 2.3)', () => {
  it('flags a date after today as dob-in-future', () => {
    expect(checkDateOfBirth({ y: 2026, m: 11, d: 17 }, today)).toEqual(['dob-in-future']);
    expect(checkDateOfBirth({ y: 2030, m: 1, d: 1 }, today)).toEqual(['dob-in-future']);
  });

  it('accepts today and ordinary ages', () => {
    expect(checkDateOfBirth(today, today)).toEqual([]);
    expect(checkDateOfBirth(march5, today)).toEqual([]);
  });

  it('warns above 120 years, counting whole years', () => {
    expect(ageOn({ y: 1906, m: 11, d: 16 }, today)).toBe(120);
    expect(checkDateOfBirth({ y: 1906, m: 11, d: 16 }, today)).toEqual([]);
    expect(ageOn({ y: 1906, m: 11, d: 15 }, today)).toBe(120);
    expect(ageOn({ y: 1905, m: 11, d: 17 }, today)).toBe(120);
    expect(checkDateOfBirth({ y: 1905, m: 11, d: 16 }, today)).toEqual(['dob-implausible']);
    expect(checkDateOfBirth({ y: 1800, m: 1, d: 1 }, today)).toEqual(['dob-implausible']);
  });

  it('uses the today it is given', () => {
    const in2200 = { y: 2200, m: 1, d: 1 };
    expect(checkDateOfBirth(march5, in2200)).toEqual(['dob-implausible']);
    expect(checkDateOfBirth(march5, { y: 2000, m: 1, d: 1 })).toEqual(['dob-in-future']);
  });
});
