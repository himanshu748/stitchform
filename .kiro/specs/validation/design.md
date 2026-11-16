# Design: Validation (F5)

Requirements: [requirements.md](requirements.md). Types `FormField`, `Issue`, `Severity` come from `src/form-model` (see the field-mapping design).

## External APIs

None at runtime. Plain TypeScript, no DOM, no network.

- `String.prototype.normalize("NFC")`: [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize).
- Calendar checks use integer arithmetic (leap-year rule), not `Date` parsing of strings, because `Date.parse` behaviour for non-ISO strings is implementation-defined ([MDN Date.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse)).
- Tests: fast-check `fc.assert`, `fc.property`, `fc.integer`, `fc.constantFrom` (Context7 `/dubzzz/fast-check`, installed 4.10.2 declarations). Dates are generated as `{ y, m, d }` integers, not `fc.date`, so no time zone enters the property.

## Module layout

```
src/validation/
  digits.ts        toAsciiDigits, toDevanagariDigits
  hindi-numbers.ts Hindi number words 0 to 99 (data), parseHindiNumber
  months.ts        English and Hindi month names and short forms (data)
  dates.ts         parseDate, formatDate, isValidCalendarDate, resolveTwoDigitYear
  validators.ts    validateField and one validator per FieldType, normaliseText, SIGNATURE_PRESENT
  choice-words.json  yes/no words (EN, HI) and other ways to say sample-form options (data)
  issues.ts        IssueCode union, severity table
  messages.en.json, messages.hi.json   plain-language message per IssueCode
  index.ts
```

## Types and API

```ts
export interface CalendarDate { y: number; m: number; d: number } // m 1..12, d 1..31

export type DateFormat =
  | "DD/MM/YYYY" | "D/M/YYYY" | "DD-MM-YYYY" | "DD.MM.YYYY" | "D-M-YY" | "YYYY-MM-DD";

export type IssueCode =
  | "required-missing" | "signature-missing" | "photo-paste-after-print"
  | "date-unparsed" | "date-impossible" | "date-two-digit-year"
  | "dob-in-future" | "dob-implausible"
  | "number-invalid" | "choice-unknown" | "checkbox-unknown"
  | "free-text-ignored" | "llm-suggestion" | "llm-rejected";

export interface ValidationContext { today: CalendarDate; lang: "en" | "hi" }

export type ValidationOutcome =
  | { ok: true; value: string; issues: Issue[] }    // issues may hold warnings or info
  | { ok: false; issues: Issue[] };                 // at least one error

export function validateField(field: FormField, raw: string, ctx: ValidationContext): ValidationOutcome;
export function parseDate(text: string, opts: { role: "dob" | "other"; today: CalendarDate }):
  { ok: true; date: CalendarDate; twoDigitYear: boolean } | { ok: false; code: "date-unparsed" | "date-impossible" };
export function formatDate(d: CalendarDate, f: DateFormat, digits?: "ascii" | "devanagari"): string;
```

`llm-suggestion` and `llm-rejected` are defined here because the issue list is shared, but only the llm-adapter emits them.

Conventions settled during implementation:

- `{ ok: true, value: "" }` means "no answer". It is returned only for fields that are not required, and for `photo` fields, which always get `photo-paste-after-print` (field-mapping Req 5.5). The mapper turns it into status `empty`.
- A signature is an image, not text. For `signature` fields the mapper passes `SIGNATURE_PRESENT` (`"signed"`) as `raw` when the user drew or uploaded one, and `""` otherwise. Any other text counts as no signature, so typing a name never creates one (Req 4.3).
- Choice matching (Req 3.3) tries, in order, and only accepts a single match: the option label itself (case-insensitive, Devanagari folded), the label without a trailing "(...)" hint ("Band A" for "Band A (demo)"), then the synonyms listed for that option in `choice-words.json`. When two options have the same key only the first is used, so the returned label always validates to itself (Req 3.5).
- Text normalisation removes control characters other than whitespace before collapsing whitespace, and applies NFC last.

## Date parsing rules

1. `toAsciiDigits` maps U+0966 to U+096F onto 0 to 9 (Req 1.2).
2. Numeric patterns, tried in order: `YYYY-MM-DD`, then day-first `D[/-.]M[/-.]YYYY` and `D[/-.]M[/-.]YY`. Any separator mix within one date is rejected as `date-unparsed` to avoid guessing.
3. Word patterns (Req 1.3): `<day> <month> <year>`, `<month> <day>, <year>`, where day and year may be digits or Hindi number words, and month is an English or Hindi month name or a 3-letter English short form. Hindi years: "उन्नीस सौ X" is 1900 + X, "दो हज़ार X" is 2000 + X, with "हज़ार" and "हजार" both accepted. As implemented: English ordinal suffixes ("5th") and the filler words "of", "the" and "सन" are allowed; Hindi words are compared after removing the nukta and writing chandrabindu as anusvara (`foldDevanagari`), so "पाँच" and "पांच" match; the general rule is "<n> सौ [x]" (n 1 to 99) and "<n> हज़ार [x]" (n 1 to 9); a two-digit year in a word date uses the same pivot as numeric dates; exactly one month word must appear.
4. Calendar check with the Gregorian leap-year rule (Req 1.5).
5. Two-digit years (Req 1.6): DOB uses the latest year ending in those digits for which the whole date (day, month, year) is not after `today` (`resolveTwoDigitYear`), so "20-12-26" read on 16/11/2026 gives 1926, not a future 2026; other dates use 2000 + YY. Either way a `date-two-digit-year` warning is added. DOB plausibility (`dob-in-future`, `dob-implausible` above 120 whole years) is `checkDateOfBirth(date, today)`, called by `validateField`.
6. Output is always canonical `DD/MM/YYYY` in ASCII digits (Req 1.4). The UI shows the value in Devanagari digits if the user typed Devanagari (steering file rule), using `toDevanagariDigits` only for display.

## Error handling

Validators are total (Req 5.3): every branch returns a `ValidationOutcome`. Unexpected input (control characters, very long strings) is cut at 200 characters before parsing and gives `date-unparsed` or the type's invalid code. Issues never include the value (Req 5.1).

## Correctness properties

This spec owns P2 and supplies the validator that P1 and P5 depend on.

| ID | Property | Requirement IDs | Owner spec | Test file |
|---|---|---|---|---|
| P1 | Every required field after mapping is `filled` with a value that passes its validator, or `flagged` with an `error` issue. | field-mapping 5.1, 5.2, 5.4; validation 4.1 | field-mapping | `src/mapping/map-answers.property.test.ts` |
| P2 | For any valid `CalendarDate` in 1900 to 2099, any `DateFormat` and either digit set, `parseDate(formatDate(d, f, digits))` returns `d`. For `D-M-YY` the property holds for `role: "other"` and years 2000 to 2099, the range the pivot maps back to. | validation 1.1, 1.2, 1.4, 1.8 | validation | `src/validation/dates.property.test.ts` |
| P3 | Right passphrase returns the original answers; wrong passphrase or tampered bytes never yield data. | stitch-code 5.1, 5.2, 2.3 | stitch-code | `src/stitch-code/round-trip.property.test.ts` |
| P4 | Mapping already-mapped answers again gives the same field values (exact statement in the field-mapping design). | field-mapping 6.1, 6.2; validation 3.5 | field-mapping | `src/mapping/map-answers.property.test.ts` |
| P5 | No LLM output makes a field `filled` with a value that fails its validator. | llm-adapter 5.1, 5.2, 5.3 | llm-adapter | `src/llm/merge.property.test.ts` |

Extra properties for this spec (not numbered in PLAN.md, kept local):

- Validator idempotence (Req 3.5): for any field and any string, if `validateField` returns `ok` with `value`, validating `value` again returns `ok` with the same `value`.
- Totality (Req 5.3): `validateField` never throws for `fc.string()` input of any unit, including `"grapheme"`.

## Testing

- Example tests for every format in Req 1.1, each Hindi example in Req 1.3, 29/02 on leap and non-leap years, and every issue code.
- A check that `messages.en.json` and `messages.hi.json` contain every `IssueCode` (Req 5.2).
