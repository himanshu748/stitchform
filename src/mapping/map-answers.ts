// Rule-based mapping (field-mapping Req 3, 4.4, 5, 6.3, 7): turn the user's answers into one
// FieldResult per form field. Prompted answers go to their field (the latest wins), free text is
// cut by `segment`, a prompted answer beats free text, and every value goes through
// `validateField`. Pure: no network, no storage, no logging (Req 6.3, 7.1, 7.2).

import type { Answer, AnswerSource, FieldResult, FormField, FormModel, MappingResult } from '../form-model';
import { SIGNATURE_PRESENT, issue, normaliseText, validateField, type ValidationContext } from '../validation';
import { buildLabelIndex, segment } from './segment';

interface Candidate {
  raw: string;
  source: AnswerSource;
}

function resultFor(field: FormField, candidate: Candidate | undefined, signed: boolean, ctx: ValidationContext): FieldResult {
  // A signature is never text: only a drawn or uploaded image counts (Req 5.4).
  if (field.type === 'signature') {
    const r = validateField(field, signed ? SIGNATURE_PRESENT : '', ctx);
    if (!r.ok) return { fieldId: field.id, status: 'flagged', issues: r.issues };
    return r.value === '' ? { fieldId: field.id, status: 'empty', issues: r.issues } : { fieldId: field.id, status: 'filled', value: r.value, issues: r.issues };
  }
  // Photos are pasted after printing; answers are never used for them (Req 5.5).
  const raw = field.type === 'photo' ? '' : (candidate?.raw ?? '');
  const r = validateField(field, raw, ctx);
  if (r.ok && r.value === '') return { fieldId: field.id, status: 'empty', issues: r.issues };
  if (r.ok) return { fieldId: field.id, status: 'filled', value: r.value, provenance: candidate?.source ?? 'typed', issues: r.issues };
  // Keep what the user entered so they can edit it (Req 3.3), unless it was blank.
  if (candidate === undefined || normaliseText(candidate.raw) === '') return { fieldId: field.id, status: 'flagged', issues: r.issues };
  return { fieldId: field.id, status: 'flagged', raw: candidate.raw, provenance: candidate.source, issues: r.issues };
}

/**
 * Map answers onto a form. Answers are taken in `seq` order (ties keep input order). For each
 * field the latest prompted answer is used, even when blank, so the user can clear a field; if
 * there is none, the latest free-text segment for it is used. A free-text segment that loses to
 * a prompted answer adds one `free-text-ignored` warning (Req 4.4). Text aimed at signature or
 * photo fields is never used. A prompted answer for a field the form does not have, and free
 * text that matches no single field, go to `unmatched`. `signatures` holds the IDs of fields
 * with a drawn or uploaded signature. `ctx` gives validation its "today", so the result depends
 * on nothing but the arguments (Req 6.1).
 */
export function mapAnswers(
  form: FormModel,
  answers: readonly Answer[],
  signatures: ReadonlySet<string>,
  ctx: ValidationContext,
): MappingResult {
  const fieldIds = new Set(form.fields.map((f) => f.id));
  const index = buildLabelIndex(form.fields);
  const ordered = answers.map((a, i) => ({ a, i })).sort((x, y) => x.a.seq - y.a.seq || x.i - y.i);

  const prompted = new Map<string, Candidate>();
  const freeText = new Map<string, Candidate>();
  const unmatched: string[] = [];

  for (const { a } of ordered) {
    if (a.promptedFieldId !== undefined) {
      if (fieldIds.has(a.promptedFieldId)) {
        prompted.set(a.promptedFieldId, { raw: a.text, source: a.source });
      } else {
        const text = normaliseText(a.text);
        if (text !== '') unmatched.push(text);
      }
      continue;
    }
    const cut = segment(a.text, index);
    for (const s of cut.segments) freeText.set(s.fieldId, { raw: s.value, source: a.source });
    unmatched.push(...cut.unmatched);
  }

  const fields = form.fields.map((field): [string, FieldResult] => {
    const own = prompted.get(field.id);
    const result = resultFor(field, own ?? freeText.get(field.id), signatures.has(field.id), ctx);
    const textUsed = field.type !== 'signature' && field.type !== 'photo';
    if (textUsed && own !== undefined && freeText.has(field.id)) result.issues = [...result.issues, issue(field.id, 'free-text-ignored')];
    return [field.id, result];
  });

  return { formId: form.id, fields: Object.fromEntries(fields), unmatched };
}

const DEVANAGARI = /[\u0900-\u097f]/u;

/**
 * Turn a mapping result back into prompted answers (used by P4 and by the stitch code): one per
 * `filled` field (its normalised value) and one per `flagged` field that kept the user's raw
 * text, with `seq` 0, 1, 2, ... in the order of `result.fields`. Only results that came from an
 * answer carry `provenance`, so signature fields, which come from the signatures set, are never
 * turned into text. `lang` is "hi" when the text contains Devanagari script, otherwise "en";
 * the mapper does not depend on it.
 */
export function toPromptedAnswers(result: MappingResult): Answer[] {
  const out: Answer[] = [];
  for (const r of Object.values(result.fields)) {
    const text = r.status === 'filled' ? r.value : r.status === 'flagged' ? r.raw : undefined;
    if (text === undefined || r.provenance === undefined) continue;
    out.push({ text, source: r.provenance, lang: DEVANAGARI.test(text) ? 'hi' : 'en', promptedFieldId: r.fieldId, seq: out.length });
  }
  return out;
}
