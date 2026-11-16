// Property P2 (validation Req 1.1, 1.2, 1.4, 1.8): for any valid date d in 1900 to 2099, any
// supported numeric format f and either digit set, parseDate(formatDate(d, f, digits)) returns d.
// For D-M-YY the property holds for role "other" and years 2000 to 2099, the range the pivot
// maps back to. Dates are generated as { y, m, d } integers, never fc.date, so no time zone
// enters the property.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DATE_FORMATS,
  canonicalDate,
  compareDates,
  daysInMonth,
  formatDate,
  isValidCalendarDate,
  parseDate,
  type CalendarDate,
} from './dates';

const today: CalendarDate = { y: 2026, m: 11, d: 16 };

function calendarDateArb(minYear: number, maxYear: number): fc.Arbitrary<CalendarDate> {
  return fc
    .record({ y: fc.integer({ min: minYear, max: maxYear }), m: fc.integer({ min: 1, max: 12 }) })
    .chain(({ y, m }) => fc.integer({ min: 1, max: daysInMonth(y, m) }).map((d) => ({ y, m, d })));
}

const digitsArb = fc.constantFrom('ascii' as const, 'devanagari' as const);
const fourDigitFormats = DATE_FORMATS.filter((f) => f !== 'D-M-YY');

describe('P2: date round-trip', () => {
  it('parseDate(formatDate(d, f, digits)) == d for every four-digit-year format', () => {
    fc.assert(
      fc.property(calendarDateArb(1900, 2099), fc.constantFrom(...fourDigitFormats), digitsArb, (d, f, digits) => {
        const parsed = parseDate(formatDate(d, f, digits), { role: 'other', today });
        expect(parsed).toEqual({ ok: true, date: d, twoDigitYear: false });
      }),
    );
  });

  it('parseDate(formatDate(d, "D-M-YY", digits)) == d for role "other" and years 2000 to 2099', () => {
    fc.assert(
      fc.property(calendarDateArb(2000, 2099), digitsArb, (d, digits) => {
        const parsed = parseDate(formatDate(d, 'D-M-YY', digits), { role: 'other', today });
        expect(parsed).toEqual({ ok: true, date: d, twoDigitYear: true });
      }),
    );
  });

  it('the canonical value of a parsed date parses to the same date', () => {
    fc.assert(
      fc.property(calendarDateArb(1900, 2099), fc.constantFrom(...DATE_FORMATS), digitsArb, (d, f, digits) => {
        const first = parseDate(formatDate(d, f, digits), { role: 'other', today });
        if (!first.ok) throw new Error(`could not parse ${formatDate(d, f, digits)}`);
        const again = parseDate(canonicalDate(first.date), { role: 'other', today });
        expect(again).toEqual({ ok: true, date: first.date, twoDigitYear: false });
      }),
    );
  });

  it('never turns written numbers into a different date (Req 1.5, 1.7)', () => {
    const pad = (n: number, w: number): string => String(n).padStart(w, '0');
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        (y, m, d) => {
          const parsed = parseDate(`${pad(d, 2)}/${pad(m, 2)}/${pad(y, 4)}`, { role: 'other', today });
          if (isValidCalendarDate({ y, m, d })) expect(parsed).toEqual({ ok: true, date: { y, m, d }, twoDigitYear: false });
          else expect(parsed).toEqual({ ok: false, code: 'date-impossible' });
        },
      ),
    );
  });

  it('a two-digit date of birth resolves to the latest matching date that is not after today (Req 1.6)', () => {
    fc.assert(
      fc.property(calendarDateArb(1900, 2099), calendarDateArb(1950, 2099), (d, todayArb) => {
        const parsed = parseDate(formatDate(d, 'D-M-YY'), { role: 'dob', today: todayArb });
        if (!parsed.ok) {
          // Only 29 February can fail, when the resolved year is not a leap year.
          expect([d.m, d.d, parsed.code]).toEqual([2, 29, 'date-impossible']);
          return;
        }
        expect(parsed.twoDigitYear).toBe(true);
        expect([parsed.date.m, parsed.date.d, parsed.date.y % 100]).toEqual([d.m, d.d, d.y % 100]);
        expect(compareDates(parsed.date, todayArb)).toBeLessThanOrEqual(0);
        expect(compareDates({ ...parsed.date, y: parsed.date.y + 100 }, todayArb)).toBeGreaterThan(0);
      }),
    );
  });
});
