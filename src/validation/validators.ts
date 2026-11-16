// validateField and one validator per field type (validation Req 3, 4, 5). Every validator is
// total (never throws, Req 5.3) and idempotent (validating a normalised value returns the same
// value with no new error, Req 3.5). Issues never contain the value (Req 5.1).

import type { FieldType, FormField, Issue } from '../form-model/types';
import words from './choice-words.json';
import { canonicalDate, checkDateOfBirth, parseDate, type CalendarDate } from './dates';
import { toAsciiDigits } from './digits';
import { foldDevanagari } from './hindi-numbers';
import { issue } from './issues';

export interface ValidationContext {
  today: CalendarDate;
  lang: 'en' | 'hi';
}

export type ValidationOutcome =
  | { ok: true; value: string; issues: Issue[] } // issues may hold warnings or info
  | { ok: false; issues: Issue[] }; // at least one error

/**
 * A signature is an image, not text. The mapper passes this marker as the raw value of a
 * signature field when the user has drawn or uploaded one, and "" when not. Any other text
 * counts as no signature, so typing a name never creates one (Req 4.3).
 */
export const SIGNATURE_PRESENT = 'signed';

/** Longest number, choice or checkbox answer worth parsing. Longer input is invalid for those types. */
const MAX_PARSED_INPUT = 200;

/**
 * Text normalisation (Req 3.1): control characters other than whitespace removed, whitespace
 * runs collapsed to one space, trimmed, then NFC. NFC runs last because removing a character
 * can bring a base letter and a combining mark together.
 */
export function normaliseText(raw: string): string {
  return raw
    .replace(/\p{Cc}/gu, (c) => (/\s/u.test(c) ? c : ''))
    .replace(/\s+/gu, ' ')
    .trim()
    .normalize('NFC');
}

/** Comparison key for choice and checkbox words: normalised, lower-cased, Devanagari folded, trailing punctuation dropped. */
function wordKey(s: string): string {
  return foldDevanagari(normaliseText(s)).replace(/[\s.:*!?\u0964]+$/u, '');
}

const YES = new Set(words.checkbox.yes.map(wordKey));
const NO = new Set(words.checkbox.no.map(wordKey));
const OPTION_SYNONYMS = new Map<string, Set<string>>(
  Object.entries(words.options as Record<string, string[]>).map(([option, list]) => [wordKey(option), new Set(list.map(wordKey))]),
);
const TRAILING_HINT = /\s*\([^()]*\)$/u;

const ok = (value: string, issues: Issue[] = []): ValidationOutcome => ({ ok: true, value, issues });
const fail = (...issues: Issue[]): ValidationOutcome => ({ ok: false, issues });

function validateNumber(field: FormField, s: string): ValidationOutcome {
  const digits = toAsciiDigits(s).replace(/\s/gu, '');
  if (digits.length > MAX_PARSED_INPUT || !/^[0-9]+$/u.test(digits)) return fail(issue(field.id, 'number-invalid'));
  return ok(digits);
}

function validateDate(field: FormField, s: string, ctx: ValidationContext): ValidationOutcome {
  const role = field.dateRole ?? 'other';
  const parsed = parseDate(s, { role, today: ctx.today });
  if (!parsed.ok) return fail(issue(field.id, parsed.code));
  const issues: Issue[] = parsed.twoDigitYear ? [issue(field.id, 'date-two-digit-year')] : [];
  if (role === 'dob') issues.push(...checkDateOfBirth(parsed.date, ctx.today).map((code) => issue(field.id, code)));
  return issues.some((i) => i.severity === 'error') ? fail(...issues) : ok(canonicalDate(parsed.date), issues);
}

/**
 * Options in form order, keeping only the first option for each key, so the value returned is
 * always an option that validates to itself.
 */
function distinctOptions(field: FormField): { label: string; key: string }[] {
  const seen = new Set<string>();
  const out: { label: string; key: string }[] = [];
  for (const label of field.choices ?? []) {
    const key = wordKey(label);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    out.push({ label, key });
  }
  return out;
}

function onlyMatch(options: readonly { label: string; key: string }[], test: (o: { label: string; key: string }) => boolean): string | null {
  const hits = options.filter(test);
  return hits.length === 1 ? (hits[0]?.label ?? null) : null;
}

function validateChoice(field: FormField, s: string): ValidationOutcome {
  const options = distinctOptions(field);
  const key = s.length > MAX_PARSED_INPUT ? '' : wordKey(s);
  const match =
    key === ''
      ? null
      : (onlyMatch(options, (o) => o.key === key) ??
        onlyMatch(options, (o) => {
          const short = o.key.replace(TRAILING_HINT, '');
          return short !== '' && short === key;
        }) ??
        onlyMatch(options, (o) => OPTION_SYNONYMS.get(o.key)?.has(key) ?? false));
  if (match !== null) return ok(match);
  return fail(issue(field.id, 'choice-unknown', { options: (field.choices ?? []).join(', ') }));
}

function validateCheckbox(field: FormField, s: string): ValidationOutcome {
  const key = s.length > MAX_PARSED_INPUT ? '' : wordKey(s);
  if (YES.has(key)) return ok('yes');
  if (NO.has(key)) return ok('no');
  return fail(issue(field.id, 'checkbox-unknown'));
}

const VALIDATORS: Record<Exclude<FieldType, 'signature' | 'photo'>, (f: FormField, s: string, ctx: ValidationContext) => ValidationOutcome> = {
  text: (_f, s) => ok(s),
  number: validateNumber,
  date: validateDate,
  choice: validateChoice,
  checkbox: validateCheckbox,
};

/**
 * Validate one raw answer for a field. Returns the normalised value, or the issues that stop it
 * from being used. `ok` with value "" means "no answer" and only happens for fields that are not
 * required (and for photo fields, which Stitchform never fills). For signature fields `raw` is
 * SIGNATURE_PRESENT or "" (see above).
 */
export function validateField(field: FormField, raw: string, ctx: ValidationContext): ValidationOutcome {
  if (field.type === 'photo') return ok('', [issue(field.id, 'photo-paste-after-print')]);
  const s = normaliseText(raw);
  if (field.type === 'signature') {
    if (s === SIGNATURE_PRESENT) return ok(SIGNATURE_PRESENT);
    return field.required ? fail(issue(field.id, 'signature-missing')) : ok('');
  }
  if (s === '') return field.required ? fail(issue(field.id, 'required-missing')) : ok('');
  const validator = VALIDATORS[field.type] ?? VALIDATORS.text;
  return validator(field, s, ctx);
}
