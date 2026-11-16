// Date parsing and formatting (validation Req 1). Calendar checks use integer arithmetic and the
// Gregorian leap-year rule, never Date.parse, whose handling of non-ISO strings is
// implementation-defined. Nothing here reads the clock: "today" is always passed in (Req 2.3).

import { toAsciiDigits, toDevanagariDigits } from './digits';

export interface CalendarDate {
  y: number;
  /** 1 to 12 */
  m: number;
  /** 1 to 31 */
  d: number;
}

export type DateFormat = 'DD/MM/YYYY' | 'D/M/YYYY' | 'DD-MM-YYYY' | 'DD.MM.YYYY' | 'D-M-YY' | 'YYYY-MM-DD';

export const DATE_FORMATS: readonly DateFormat[] = [
  'DD/MM/YYYY',
  'D/M/YYYY',
  'DD-MM-YYYY',
  'DD.MM.YYYY',
  'D-M-YY',
  'YYYY-MM-DD',
];

/** Input longer than this is never a date; it is rejected before any parsing work. */
export const MAX_DATE_INPUT = 200;

export type ParseDateResult =
  | { ok: true; date: CalendarDate; twoDigitYear: boolean }
  | { ok: false; code: 'date-unparsed' | 'date-impossible' };

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** True for a real Gregorian date in years 1 to 9999 (Req 1.5). */
export function isValidCalendarDate(date: CalendarDate): boolean {
  const { y, m, d } = date;
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

/** Negative if a is before b, 0 if equal, positive if after. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** Write a date in one of the supported numeric formats (Req 1.8). */
export function formatDate(d: CalendarDate, f: DateFormat, digits: 'ascii' | 'devanagari' = 'ascii'): string {
  let out: string;
  switch (f) {
    case 'DD/MM/YYYY':
      out = `${pad(d.d, 2)}/${pad(d.m, 2)}/${pad(d.y, 4)}`;
      break;
    case 'D/M/YYYY':
      out = `${d.d}/${d.m}/${pad(d.y, 4)}`;
      break;
    case 'DD-MM-YYYY':
      out = `${pad(d.d, 2)}-${pad(d.m, 2)}-${pad(d.y, 4)}`;
      break;
    case 'DD.MM.YYYY':
      out = `${pad(d.d, 2)}.${pad(d.m, 2)}.${pad(d.y, 4)}`;
      break;
    case 'D-M-YY':
      out = `${d.d}-${d.m}-${pad(d.y % 100, 2)}`;
      break;
    case 'YYYY-MM-DD':
      out = `${pad(d.y, 4)}-${pad(d.m, 2)}-${pad(d.d, 2)}`;
      break;
  }
  return digits === 'devanagari' ? toDevanagariDigits(out) : out;
}

/** Canonical form of a valid date: DD/MM/YYYY with ASCII digits (Req 1.4). */
export function canonicalDate(d: CalendarDate): string {
  return formatDate(d, 'DD/MM/YYYY');
}

export interface ParseDateOptions {
  role: 'dob' | 'other';
  today: CalendarDate;
}

/** Year for a two-digit year. Until the pivot rule lands, every two-digit year is 2000 + YY. */
function resolveYear(yy: number): number {
  return 2000 + yy;
}

const ISO = /^(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})$/u;
// Day first, one separator used twice (the back-reference rejects mixes such as 05/03-2004).
const DAY_FIRST = /^(\d{1,2})\s*([/.-])\s*(\d{1,2})\s*\2\s*(\d{4}|\d{2})$/u;

function numericDate(s: string): { date: CalendarDate; twoDigitYear: boolean } | null {
  const iso = ISO.exec(s);
  if (iso) return { date: { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) }, twoDigitYear: false };
  const dm = DAY_FIRST.exec(s);
  if (dm) {
    const yearText = dm[4] ?? '';
    const twoDigitYear = yearText.length === 2;
    const y = twoDigitYear ? resolveYear(Number(yearText)) : Number(yearText);
    return { date: { y, m: Number(dm[3]), d: Number(dm[1]) }, twoDigitYear };
  }
  return null;
}

/**
 * Parse a date written as DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY, D-M-YY or YYYY-MM-DD,
 * with ASCII or Devanagari digits (Req 1.1, 1.2). A text that is not a date gives
 * `date-unparsed`; numbers that are not a real calendar date give `date-impossible` (Req 1.5,
 * 1.7). The date is never moved to a different day.
 */
export function parseDate(text: string, _opts: ParseDateOptions): ParseDateResult {
  if (text.length > MAX_DATE_INPUT) return { ok: false, code: 'date-unparsed' };
  const s = toAsciiDigits(text.normalize('NFC')).replace(/\s+/gu, ' ').trim();
  const found = numericDate(s);
  if (found === null) return { ok: false, code: 'date-unparsed' };
  if (!isValidCalendarDate(found.date)) return { ok: false, code: 'date-impossible' };
  return { ok: true, date: found.date, twoDigitYear: found.twoDigitYear };
}
