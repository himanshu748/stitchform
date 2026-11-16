// Date parsing and formatting (validation Req 1). Calendar checks use integer arithmetic and the
// Gregorian leap-year rule, never Date.parse, whose handling of non-ISO strings is
// implementation-defined. Nothing here reads the clock: "today" is always passed in (Req 2.3).

import { toAsciiDigits, toDevanagariDigits } from './digits';
import { HINDI_HUNDRED, HINDI_THOUSAND, foldDevanagari, parseHindiNumber } from './hindi-numbers';
import { monthFromName } from './months';

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

/**
 * Four-digit year for a two-digit year (Req 1.6). For a date of birth: the latest year ending in
 * those digits for which the whole date is not after `today` (so a two-digit DOB is never put
 * in the future). For any other date: 2000 + YY. The caller adds a `date-two-digit-year`
 * warning either way so the user confirms.
 */
export function resolveTwoDigitYear(
  yy: number,
  opts: ParseDateOptions & { m: number; d: number },
): number {
  if (opts.role !== 'dob') return 2000 + yy;
  const { today } = opts;
  let y = today.y - ((((today.y - yy) % 100) + 100) % 100);
  if (y === today.y && compareDates({ y, m: opts.m, d: opts.d }, today) > 0) y -= 100;
  return y;
}

/** Oldest age, in whole years, that a date of birth may give without a warning (Req 2.2). */
export const MAX_PLAUSIBLE_AGE = 120;

/** Age in whole years on `today` of someone born on `dob`. */
export function ageOn(dob: CalendarDate, today: CalendarDate): number {
  const hadBirthday = today.m > dob.m || (today.m === dob.m && today.d >= dob.d);
  return today.y - dob.y - (hadBirthday ? 0 : 1);
}

/**
 * Date of birth plausibility (Req 2.1, 2.2): `dob-in-future` when the date is after `today`,
 * `dob-implausible` when the age is above 120 years. `today` is an explicit input (Req 2.3).
 */
export function checkDateOfBirth(dob: CalendarDate, today: CalendarDate): ('dob-in-future' | 'dob-implausible')[] {
  if (compareDates(dob, today) > 0) return ['dob-in-future'];
  return ageOn(dob, today) > MAX_PLAUSIBLE_AGE ? ['dob-implausible'] : [];
}

const ISO = /^(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})$/u;
// Day first, one separator used twice (the back-reference rejects mixes such as 05/03-2004).
const DAY_FIRST = /^(\d{1,2})\s*([/.-])\s*(\d{1,2})\s*\2\s*(\d{4}|\d{2})$/u;

interface FoundDate {
  date: CalendarDate;
  twoDigitYear: boolean;
}

// Words that may sit inside a spoken date without changing it: "5th of March", "सन 2004".
const FILLER_WORDS = new Set(['of', 'the', 'सन', 'सन्'].map(foldDevanagari));
const HUNDRED = foldDevanagari(HINDI_HUNDRED);
const THOUSAND = foldDevanagari(HINDI_THOUSAND);

function wordTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[,\u0964]/gu, ' ')
    .split(' ')
    .map((t) => t.replace(/\.$/u, ''))
    .filter((t) => t !== '' && !FILLER_WORDS.has(foldDevanagari(t)));
}

/** A day: 1 or 2 digits with an optional English ordinal suffix, or a Hindi number word. */
function dayFromToken(t: string): number | null {
  const digits = /^(\d{1,2})(st|nd|rd|th)?$/u.exec(t);
  if (digits) return Number(digits[1]);
  return parseHindiNumber(t);
}

/** Up to 99, as 1 or 2 digits or a Hindi number word. */
function smallNumber(t: string): number | null {
  return /^\d{1,2}$/u.test(t) ? Number(t) : parseHindiNumber(t);
}

/**
 * A year: four digits, two digits (pivot rule), "<n> सौ [x]" = n * 100 + x (as in
 * "उन्नीस सौ चार" = 1904) or "<n> हज़ार [x]" = n * 1000 + x (as in "दो हज़ार चार" = 2004).
 */
function yearFromTokens(
  ts: readonly string[],
  opts: ParseDateOptions,
  m: number,
  d: number,
): { y: number; twoDigitYear: boolean } | null {
  const [first, unit, rest, extra] = ts;
  if (first === undefined || extra !== undefined) return null;
  if (unit === undefined) {
    if (/^\d{4}$/u.test(first)) return { y: Number(first), twoDigitYear: false };
    if (/^\d{2}$/u.test(first)) {
      return { y: resolveTwoDigitYear(Number(first), { ...opts, m, d }), twoDigitYear: true };
    }
    return null;
  }
  const n = parseHindiNumber(first);
  const x = rest === undefined ? 0 : smallNumber(rest);
  if (n === null || x === null) return null;
  const unitKey = foldDevanagari(unit);
  if (unitKey === HUNDRED && n >= 1 && (rest === undefined || x >= 1)) return { y: n * 100 + x, twoDigitYear: false };
  if (unitKey === THOUSAND && n >= 1 && n <= 9) return { y: n * 1000 + x, twoDigitYear: false };
  return null;
}

/**
 * Spoken or written dates (Req 1.3): "<day> <month> <year>" or "<month> <day>, <year>", where
 * the month is an English or Hindi name or a three-letter English short form, and the day and
 * year are digits or Hindi number words.
 */
function wordDate(s: string, opts: ParseDateOptions): FoundDate | null {
  const ts = wordTokens(s);
  const monthAt = ts.flatMap((t, i) => (monthFromName(t) === null ? [] : [i]));
  if (monthAt.length !== 1) return null;
  const mi = monthAt[0] ?? -1;
  const m = monthFromName(ts[mi] ?? '');
  if (m === null || (mi !== 0 && mi !== 1)) return null;
  const dayToken = mi === 1 ? ts[0] : ts[1];
  const d = dayToken === undefined ? null : dayFromToken(dayToken);
  if (d === null) return null;
  const year = yearFromTokens(ts.slice(2), opts, m, d);
  return year === null ? null : { date: { y: year.y, m, d }, twoDigitYear: year.twoDigitYear };
}

function numericDate(s: string, opts: ParseDateOptions): FoundDate | null {
  const iso = ISO.exec(s);
  if (iso) return { date: { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) }, twoDigitYear: false };
  const dm = DAY_FIRST.exec(s);
  if (dm) {
    const yearText = dm[4] ?? '';
    const d = Number(dm[1]);
    const m = Number(dm[3]);
    const twoDigitYear = yearText.length === 2;
    const y = twoDigitYear ? resolveTwoDigitYear(Number(yearText), { ...opts, m, d }) : Number(yearText);
    return { date: { y, m, d }, twoDigitYear };
  }
  return null;
}

/**
 * Parse a date written as DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY, D-M-YY or YYYY-MM-DD,
 * with ASCII or Devanagari digits (Req 1.1, 1.2), or spoken as "5 March 2004",
 * "March 5, 2004", "5 मार्च 2004" or "पाँच मार्च दो हज़ार चार" (Req 1.3). A text that is not a
 * date gives `date-unparsed`; numbers that are not a real calendar date give `date-impossible`
 * (Req 1.5, 1.7). The date is never moved to a different day. `role` and `today` only affect
 * two-digit years (Req 1.6); date of birth plausibility is checked by the caller with
 * checkDateOfBirth.
 */
export function parseDate(text: string, opts: ParseDateOptions): ParseDateResult {
  if (text.length > MAX_DATE_INPUT) return { ok: false, code: 'date-unparsed' };
  const s = toAsciiDigits(text.normalize('NFC')).replace(/\s+/gu, ' ').trim();
  const found = numericDate(s, opts) ?? wordDate(s, opts);
  if (found === null) return { ok: false, code: 'date-unparsed' };
  if (!isValidCalendarDate(found.date)) return { ok: false, code: 'date-impossible' };
  return { ok: true, date: found.date, twoDigitYear: found.twoDigitYear };
}
