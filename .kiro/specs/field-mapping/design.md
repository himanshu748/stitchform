# Design: Field model and rule-based mapping (F2)

Requirements: [requirements.md](requirements.md). Related specs: `validation` (validators and issues), `llm-adapter` (optional suggestions), `stitch-code` (refill), `capture-ocr` (produces form models).

## External APIs

None. `src/form-model` and `src/mapping` are plain TypeScript with no DOM, no network and no third-party runtime library (structure.md: pure modules). Unicode normalisation uses the built-in `String.prototype.normalize("NFC")` ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)). Property tests use fast-check `fc.assert`, `fc.property`, `fc.record`, `fc.constantFrom`, `fc.option`, `fc.array` and `fc.string`, confirmed through Context7 (`/dubzzz/fast-check`) and the installed `fast-check` 4.10.2 type declarations.

## Module boundaries

```
src/form-model/   types.ts, validate-model.ts, edit.ts, index.ts      (pure)
src/mapping/      synonyms.en.json, synonyms.hi.json, normalise-label.ts,
                  segment.ts, map-answers.ts, index.ts                   (pure)
```

- `form-model` depends on nothing.
- `mapping` depends on `form-model` and on `validation` (to validate values). It never imports `ui`, `voice`, `ocr`, `pdf` or `capture`.
- `llm-adapter` and `stitch-code` call `mapAnswers`; `mapping` does not know they exist.

## Types (`src/form-model/types.ts`)

```ts
export type FieldType =
  | "text" | "date" | "number" | "choice" | "checkbox" | "signature" | "photo";

/** Fractions of page width and height, origin top-left. 0 <= x, y, w, h and x + w <= 1, y + h <= 1. */
export interface BBox { x: number; y: number; w: number; h: number }

export interface FormField {
  id: string;            // unique within the form, [a-z0-9-]+
  label: string;         // label as printed (English or Hindi)
  type: FieldType;
  required: boolean;
  bbox: BBox;
  page: number;          // 0-based page index
  choices?: string[];    // required and non-empty when type === "choice"
  dateRole?: "dob" | "other"; // lets validation apply DOB plausibility checks
}

export interface PageInfo { index: number; widthPt: number; heightPt: number }

export interface FormModel {
  id: string;                         // e.g. "sample-lantern-hill-admission"
  title: string;
  source: "sample" | "ocr" | "manual";
  pages: PageInfo[];
  fields: FormField[];
}

export type AnswerSource = "typed" | "voice" | "stitch-code" | "llm";

export interface Answer {
  text: string;                       // raw text as typed or recognised
  source: AnswerSource;
  lang: "en" | "hi";
  promptedFieldId?: string;           // set when the user answered a prompt for one field
  seq: number;                        // order of entry; later wins (Req 3.4)
}

export type Severity = "error" | "warning" | "info";

export interface Issue {
  fieldId: string;
  code: IssueCode;                    // defined in validation/issues.ts
  severity: Severity;
  params?: Record<string, string>;    // never contains the answer value
}

export type FieldStatus = "filled" | "flagged" | "empty";

export interface FieldResult {
  fieldId: string;
  status: FieldStatus;
  value?: string;                     // normalised value, only when status === "filled"
  raw?: string;                       // what the user entered, kept when flagged so they can edit
  provenance?: AnswerSource;
  issues: Issue[];
}

export interface MappingResult {
  formId: string;
  fields: Record<string, FieldResult>; // one entry per form field, always
  unmatched: string[];                 // free-text segments that matched no single field
}
```

`IssueCode` and the validator functions live in `src/validation` (see that spec). Signature presence is not an answer; the UI passes `signatures: ReadonlySet<string>` (field IDs that have a drawn or uploaded image) into `mapAnswers`.

## Public API

```ts
// src/form-model/index.ts
export function validateFormModel(m: FormModel): { ok: true } | { ok: false; errors: string[] }; // Req 1.3
export function addField(m: FormModel, partial: Partial<FormField> & { bbox: BBox; page: number }): FormModel; // Req 2.2
export function updateField(m: FormModel, id: string, patch: Partial<Omit<FormField, "id">>): FormModel; // Req 2.1

// src/mapping/index.ts
export function mapAnswers(
  form: FormModel,
  answers: readonly Answer[],
  signatures: ReadonlySet<string>,
): MappingResult;
export function toPromptedAnswers(result: MappingResult): Answer[]; // used by P4 and stitch-code
export function normaliseLabel(s: string): string;                  // Req 4.2
```

All functions are pure and return new objects; nothing is mutated in place.

## Algorithm (`mapAnswers`)

1. Sort answers by `seq`. Keep the last prompted answer per field (Req 3.4).
2. For each answer without `promptedFieldId`, call `segment(text, lang)`: find every occurrence of a known label synonym (after `normaliseLabel`) and cut the text into `[label, value]` pairs. A segment matches the field whose normalised label or synonym set contains the segment's label. Exact match beats synonym match; two equal-best matches go to `unmatched` (Req 4.3).
3. A prompted answer always beats a free-text segment for the same field; the losing segment adds a `free-text-ignored` warning (Req 4.4).
4. For each field with a candidate value, call `validateField(field, raw)` from `validation`. Pass gives `filled` with the normalised value; fail gives `flagged` with `raw` and the issues (Req 3.2, 3.3).
5. Fields with no candidate: required gives `flagged` + `required-missing` (error); not required gives `empty` (Req 5.2, 5.3). `signature` fields use `signatures` instead of answers (Req 5.4). `photo` fields are always `empty` with a `photo-paste-after-print` info issue (Req 5.5).
6. Every field ID of the form appears in `fields`, in form order.

`toPromptedAnswers` emits one prompted answer per `filled` field (value as text) and per `flagged` field that has `raw`, with increasing `seq`. Because normalised values are fixed points of their validators (validation spec, Req 1.4 and 3.x), mapping them again gives the same result (P4).

## Synonym data

`synonyms.en.json` and `synonyms.hi.json` map a canonical key to label variants, for example `"dob": ["date of birth", "dob", "birth date"]` and `"dob": ["जन्म तिथि", "जन्मतिथि", "जन्म की तारीख"]`. A field's synonym set is chosen by `normaliseLabel(field.label)` lookup. The Hindi lists are written for the three fictional sample forms first and are a small, hand-made list, not a complete dictionary.

## Error handling

- `validateFormModel` returns a list of plain-language errors; the UI shows them and refuses to continue until fixed.
- `mapAnswers` never throws for any input that passed `validateFormModel`; this is covered by the P1 property, which generates arbitrary answers.
- No logging of values (Req 7.1). Debug logs, if any, print field IDs and issue codes.

## Correctness properties

The five properties from PLAN.md section 7. This spec owns P1 and P4; the others are listed so the links are visible in one place.

| ID | Property | Requirement IDs | Owner spec | Test file |
|---|---|---|---|---|
| P1 | For any valid form model, any answers and any signature set, every required field in `mapAnswers` output is `filled` with a value that passes its validator, or `flagged` with at least one `error` issue. | field-mapping 5.1, 5.2, 5.4; validation 4.1 | field-mapping | `src/mapping/map-answers.property.test.ts` |
| P2 | For every supported date format and any valid date, `parse(format(d))` equals `d`, including Devanagari digits. | validation 1.1, 1.2, 1.4, 1.8 | validation | `src/validation/dates.property.test.ts` |
| P3 | Decrypting a stitch code with the right passphrase returns the original answers; any other passphrase, or any changed byte, never yields data. | stitch-code 5.1, 5.2, 2.3 | stitch-code | `src/stitch-code/round-trip.property.test.ts` |
| P4 | `mapAnswers(form, toPromptedAnswers(mapAnswers(form, a, s)), s)` equals `mapAnswers(form, a, s)` (ignoring `unmatched` and `seq`). | field-mapping 6.1, 6.2 | field-mapping | `src/mapping/map-answers.property.test.ts` |
| P5 | For any string a fake LLM provider returns, no field ends `filled` with a value that fails its validator, and no user-entered value is replaced. | llm-adapter 5.1, 5.2, 5.3 | llm-adapter | `src/llm/merge.property.test.ts` |

Generators (`src/mapping/arbitraries.ts`): a form-model arbitrary (1 to 20 fields, unique IDs, every field type, valid boxes), an answer arbitrary that mixes valid values, invalid values, empty strings, Devanagari digits and free text containing label synonyms. All generated names are fictional by construction (random strings), and fixtures are labelled demo data.

## Testing

- Unit tests for `normaliseLabel`, `segment`, duplicate-ID rejection, and one example per field type.
- P1 and P4 as above, run by `npm test` and at `FC_NUM_RUNS=20` by commit-guard.
