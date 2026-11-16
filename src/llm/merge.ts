// Merging model suggestions into the rule-based result (llm-adapter Req 5.1 to 5.4, design.md
// "Merge rules"). A suggestion only fills a field that is empty or flagged, and only with a value
// that passes the same validator as typed input. It never replaces what the user typed, spoke or
// loaded from a stitch code, and never sets a signature or photo field. The model's warnings are
// not merged into the result: collectNotes returns them on their own, so model text never ends
// up in an issue, a stitch code or a PDF. Pure: no network, no storage, no logging.

import type { FieldResult, FormField, FormModel, MappingResult } from '../form-model';
import { issue, normaliseText, validateField, type ValidationContext } from '../validation';
import type { LlmNote, LlmSuggestion } from './types';

const fieldIdsOf = (form: FormModel): ReadonlySet<string> => new Set(form.fields.map((f) => f.id));

/**
 * The value to try for each field of the form: the first suggestion for it whose value is not
 * blank. Later suggestions for the same field, and suggestions for fields the form does not
 * have, are ignored (Req 5.2).
 */
function proposedValues(form: FormModel, suggestions: readonly LlmSuggestion[]): Map<string, string> {
  const ids = fieldIdsOf(form);
  const out = new Map<string, string>();
  for (const s of suggestions) {
    if (typeof s.value !== 'string' || !ids.has(s.fieldId) || out.has(s.fieldId)) continue;
    if (normaliseText(s.value) !== '') out.set(s.fieldId, s.value);
  }
  return out;
}

/** The rule-based result for a field, copied so the merge never changes its input. */
function currentResult(ruleResult: MappingResult, fieldId: string): FieldResult {
  // Own entries only: a field ID such as "constructor" must not find Object.prototype.constructor.
  const r = Object.hasOwn(ruleResult.fields, fieldId) ? ruleResult.fields[fieldId] : undefined;
  return r === undefined ? { fieldId, status: 'empty', issues: [] } : { ...r, issues: [...r.issues] };
}

function withSuggestion(field: FormField, current: FieldResult, value: string, ctx: ValidationContext): FieldResult {
  // Rule 4: a signature or photo is never set by a suggestion (validation Req 4.3).
  if (field.type === 'signature' || field.type === 'photo') return current;
  // Rules 2 and 3: only an empty or flagged field takes a suggestion, so a value the user typed,
  // spoke or loaded from a stitch code stays as it is (Req 5.3).
  if (current.status !== 'empty' && current.status !== 'flagged') return current;
  const r = validateField(field, value, ctx);
  if (r.ok && r.value !== '') {
    // Req 5.1, 5.4: the normalised value, marked so the user reviews it before printing.
    return { fieldId: field.id, status: 'filled', value: r.value, provenance: 'llm', issues: [...r.issues, issue(field.id, 'llm-suggestion')] };
  }
  // Req 5.2: the field stays as it was, with a note that a suggestion failed the checks.
  return { ...current, issues: [...current.issues, issue(field.id, 'llm-rejected')] };
}

/**
 * Rule 5: a required field is never left empty, so P1 holds after the merge even when the
 * rule-based result had no entry for it. Photo fields are the exception, as in the mapper
 * (field-mapping Req 5.5).
 */
function keepRequired(field: FormField, r: FieldResult): FieldResult {
  if (!field.required || field.type === 'photo' || r.status !== 'empty') return r;
  const code = field.type === 'signature' ? 'signature-missing' : 'required-missing';
  const issues = r.issues.some((i) => i.code === code) ? r.issues : [...r.issues, issue(field.id, code)];
  return { ...r, status: 'flagged', issues };
}

/**
 * Merge `suggestions` into `ruleResult`, the rule-based mapping for `form`. The result has one
 * entry per form field in form order and the same `formId` and `unmatched`. For each field the
 * first non-blank suggested value is checked with `validateField` (with `ctx`, the same context
 * the mapper used) when the field is empty or flagged and is not a signature or photo field: if
 * it passes, the field is filled with the normalised value, provenance "llm" and an
 * `llm-suggestion` issue; if not, the field is kept with an added `llm-rejected` issue. Every
 * other field is kept as it was. Notes in `suggestions` are ignored here (see collectNotes).
 */
export function mergeSuggestions(
  form: FormModel,
  ruleResult: MappingResult,
  suggestions: readonly LlmSuggestion[],
  ctx: ValidationContext,
): MappingResult {
  const proposed = proposedValues(form, suggestions);
  const fields = form.fields.map((field): [string, FieldResult] => {
    const current = currentResult(ruleResult, field.id);
    const value = proposed.get(field.id);
    const next = value === undefined ? current : withSuggestion(field, current, value, ctx);
    return [field.id, keepRequired(field, next)];
  });
  return { formId: ruleResult.formId, fields: Object.fromEntries(fields), unmatched: [...ruleResult.unmatched] };
}

/**
 * The model's notes about fields of the form, in reply order (Req 5.3: suggestions may add
 * warnings). Notes for fields the form does not have are dropped (Req 5.2), the text is
 * normalised like an answer, and blank or repeated notes for a field are dropped. A note may be
 * about any field, including one the user filled, because a note changes nothing in the result.
 */
export function collectNotes(form: FormModel, suggestions: readonly LlmSuggestion[]): LlmNote[] {
  const ids = fieldIdsOf(form);
  const seen = new Set<string>();
  const out: LlmNote[] = [];
  for (const s of suggestions) {
    if (typeof s.note !== 'string' || !ids.has(s.fieldId)) continue;
    const note = normaliseText(s.note);
    const key = `${s.fieldId}\u0000${note}`;
    if (note === '' || seen.has(key)) continue;
    seen.add(key);
    out.push({ fieldId: s.fieldId, note });
  }
  return out;
}
