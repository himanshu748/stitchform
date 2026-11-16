// fast-check generators for fields and raw answers, shared by the validator properties here and
// by the mapping properties P1 and P4. Raw answers mix values each validator accepts (dates in
// every format and both digit sets, spoken English and Hindi dates, numbers, option words,
// yes/no words, the signature marker) with invalid and arbitrary text. All values are
// fictional demo data.

import fc from 'fast-check';
import type { FieldType, FormField } from '../form-model/types';
import words from './choice-words.json';
import { DATE_FORMATS, daysInMonth, formatDate, type CalendarDate } from './dates';
import { HINDI_NUMBER_WORDS } from './hindi-numbers';
import { MONTH_NAMES } from './months';
import { SIGNATURE_PRESENT, type ValidationContext } from './validators';

export function calendarDateArb(minYear = 1900, maxYear = 2099): fc.Arbitrary<CalendarDate> {
  return fc
    .record({ y: fc.integer({ min: minYear, max: maxYear }), m: fc.integer({ min: 1, max: 12 }) })
    .chain(({ y, m }) => fc.integer({ min: 1, max: daysInMonth(y, m) }).map((d) => ({ y, m, d })));
}

const hindiWord = (n: number): string => HINDI_NUMBER_WORDS[n]?.[0] ?? String(n);

function numericDateTextArb(): fc.Arbitrary<string> {
  return fc
    .tuple(calendarDateArb(), fc.constantFrom(...DATE_FORMATS), fc.constantFrom('ascii' as const, 'devanagari' as const))
    .map(([d, f, digits]) => formatDate(d, f, digits));
}

function wordDateTextArb(): fc.Arbitrary<string> {
  return fc
    .tuple(calendarDateArb(), fc.nat({ max: 1000 }), fc.boolean())
    .map(([d, pick, monthFirst]) => {
      const names = MONTH_NAMES[d.m - 1] ?? ['january'];
      const month = names[pick % names.length] ?? 'january';
      return monthFirst ? `${month} ${d.d}, ${d.y}` : `${d.d} ${month} ${d.y}`;
    });
}

function hindiWordDateTextArb(): fc.Arbitrary<string> {
  return calendarDateArb(1901, 2099).map((d) => {
    const month = MONTH_NAMES[d.m - 1]?.find((n) => /[\u0900-\u097f]/u.test(n)) ?? 'मार्च';
    const year = d.y >= 2000 ? `दो हज़ार ${d.y === 2000 ? '' : hindiWord(d.y - 2000)}` : `उन्नीस सौ ${hindiWord(d.y - 1900)}`;
    return `${hindiWord(d.d)} ${month} ${year}`.trim();
  });
}

function impossibleDateTextArb(): fc.Arbitrary<string> {
  return fc.constantFrom('31/02/2004', '29/02/2003', '00/01/2004', '12/13/2004', '2004-02-30', '31 April 2004');
}

function numberTextArb(): fc.Arbitrary<string> {
  return fc
    .tuple(fc.stringMatching(/^[0-9]{1,6}( [0-9]{1,5})?$/), fc.boolean())
    .map(([n, deva]) => (deva ? n.replace(/[0-9]/gu, (c) => String.fromCharCode(c.charCodeAt(0) + 0x0936)) : n));
}

const optionWords = Object.entries(words.options).flatMap(([option, list]) => [option, ...list]);
const yesNoWords = [...words.checkbox.yes, ...words.checkbox.no];

// Built once: fc.stringMatching is slow to build (about 3 ms each here), and generators that
// call rawAnswerArb inside .chain would otherwise rebuild it for every generated value.
const RAW_ANSWER: fc.Arbitrary<string> = fc.oneof(
  numericDateTextArb(),
  wordDateTextArb(),
  hindiWordDateTextArb(),
  impossibleDateTextArb(),
  numberTextArb(),
  fc.constantFrom(...optionWords, ...yesNoWords, SIGNATURE_PRESENT, 'Asha Verma (demo)', 'आशा वर्मा', '12 Lantern Lane'),
  fc.constantFrom('', ' ', '\t\n', '\u0000', 'e\u0000\u0301', '  a  b  '),
  fc.string({ maxLength: 30 }),
  fc.string({ unit: 'grapheme', maxLength: 20 }),
  fc.string({ unit: 'binary', maxLength: 20 }),
);

/** One raw answer, valid for some field type or not valid for any. */
export function rawAnswerArb(): fc.Arbitrary<string> {
  return RAW_ANSWER;
}

/**
 * Any string at all, for totality (Req 5.3): raw answers, every string unit fast-check offers,
 * single UTF-16 code units (so lone surrogate halves appear), text longer than the
 * 200-character parsing limit, and long runs of one separator character.
 */
export function anyStringArb(): fc.Arbitrary<string> {
  const codeUnit = fc.integer({ min: 0, max: 0xffff }).map((n) => String.fromCharCode(n));
  return fc.oneof(
    rawAnswerArb(),
    fc.string({ unit: 'binary', maxLength: 50 }),
    fc.string({ unit: 'grapheme', maxLength: 50 }),
    fc.string({ unit: codeUnit, maxLength: 50 }),
    fc.string({ unit: 'binary', minLength: 190, maxLength: 1000, size: 'max' }),
    fc
      .tuple(fc.constantFrom('.', ' ', ':', '!', '\u0964', '०', '5', 'a'), fc.integer({ min: 1, max: 5000 }), fc.string({ maxLength: 3 }))
      .map(([c, n, tail]) => c.repeat(n) + tail),
  );
}

const FIELD_TYPES: readonly FieldType[] = ['text', 'date', 'number', 'choice', 'checkbox', 'signature', 'photo'];
const SAMPLE_OPTIONS = Object.keys(words.options);
const TRAILING_HINT = /\s*\([^()]*\)$/u;

/**
 * A printed option label: a sample option, a case and spacing variant of one, random text, or
 * random text followed by a bracketed hint of any length up to 260 characters.
 */
function optionLabelArb(): fc.Arbitrary<string> {
  const text = fc.string({ minLength: 1, maxLength: 12 });
  return fc.oneof(
    fc.constantFrom(...SAMPLE_OPTIONS),
    fc.constantFrom(...SAMPLE_OPTIONS).map((o) => ` ${o.toUpperCase()}  `),
    text,
    fc
      .tuple(text, fc.string({ maxLength: 260, size: 'max' }))
      .map(([base, hint]) => `${base} (${hint.replace(/[()]/gu, '')})`),
  );
}

/**
 * One field of one of `types` (default: every type). Choice fields get 0 to 5 options that may
 * repeat, differ only in case, or shorten to the same words, so the validators are also checked
 * on models that validateFormModel would reject (a choice field with no options).
 */
export function fieldArb(types: readonly FieldType[] = FIELD_TYPES): fc.Arbitrary<FormField> {
  return fc
    .record({
      id: fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,11}$/),
      type: fc.constantFrom(...types),
      required: fc.boolean(),
      choices: fc.array(optionLabelArb(), { maxLength: 5 }),
      dateRole: fc.option(fc.constantFrom('dob' as const, 'other' as const), { nil: null }),
    })
    .map(({ choices, dateRole, ...base }) => {
      const field: FormField = { ...base, label: 'Demo field', bbox: { x: 0, y: 0, w: 0.5, h: 0.05 }, page: 0 };
      if (base.type === 'choice') field.choices = choices;
      if (base.type === 'date' && dateRole !== null) field.dateRole = dateRole;
      return field;
    });
}

/**
 * A raw answer aimed at one field: any raw answer, or for a choice field one of its option
 * labels as printed, without its bracketed hint, or lower-cased with extra spaces.
 */
export function rawForFieldArb(field: FormField): fc.Arbitrary<string> {
  const options = field.choices ?? [];
  if (options.length === 0) return rawAnswerArb();
  const option = fc.constantFrom(...options);
  return fc.oneof(
    rawAnswerArb(),
    option,
    option.map((o) => o.replace(TRAILING_HINT, '')),
    option.map((o) => `  ${o.toLowerCase()}  `),
  );
}

/** A validation context with any "today" from 1950 to 2099 and either language. */
export function validationContextArb(): fc.Arbitrary<ValidationContext> {
  return fc.record({ today: calendarDateArb(1950, 2099), lang: fc.constantFrom('en' as const, 'hi' as const) });
}
