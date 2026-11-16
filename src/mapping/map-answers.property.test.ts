// Mapping properties (field-mapping spec, design.md "Correctness properties").
// P1 (field-mapping Req 5.1, 5.2, 5.3, 5.4, 5.5; validation Req 4.1): for any valid form model,
// any answers and any signature set, every required field is `filled` with a value that passes
// its validator, or `flagged` with at least one error. Photo fields are the one exception by
// design (Req 5.5): they are always `empty` with the paste-after-print info issue.
// P4 (field-mapping Req 6.1, 6.2): mapping is deterministic, and mapping the prompted answers
// from toPromptedAnswers again gives every field the same status, value, raw text and
// provenance with no new issue. Only warnings about how an answer was written
// (date-two-digit-year, once the value is canonical) and free-text-ignored (free text is not
// carried over) may drop out. Turning that second result into answers gives the same answers,
// so a refilled form saves to the same stitch code content.
// Forms, answers and signature sets are generated demo data (SAMPLE / DEMO DATA).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { FieldResult, FormField } from '../form-model';
import { validateField, type ValidationContext } from '../validation';
import { validationContextArb } from '../validation/arbitraries';
import { formModelArb, mappingInputArb, signaturesArb } from './arbitraries';
import { mapAnswers, toPromptedAnswers } from './map-answers';

const hasError = (r: FieldResult): boolean => r.issues.some((i) => i.severity === 'error');

function expectFieldRules(field: FormField, r: FieldResult | undefined, signed: boolean, ctx: ValidationContext): void {
  expect(r?.fieldId).toBe(field.id);
  if (r === undefined) return;
  for (const i of r.issues) expect(i.fieldId).toBe(field.id);

  if (field.type === 'photo') {
    expect(r).toEqual({ fieldId: field.id, status: 'empty', issues: [{ fieldId: field.id, code: 'photo-paste-after-print', severity: 'info' }] });
    return;
  }
  if (field.type === 'signature') {
    // Only a drawn or uploaded signature fills it; text never does (Req 5.4).
    expect(r.status).toBe(signed ? 'filled' : field.required ? 'flagged' : 'empty');
    if (!signed && field.required) expect(r.issues.map((i) => i.code)).toContain('signature-missing');
  }
  if (r.status === 'filled') {
    // The value passes its validator and is a fixed point of it.
    const again = validateField(field, r.value ?? '', ctx);
    expect(again.ok && again.value).toBe(r.value);
    expect(r.value).not.toBe('');
  } else if (r.status === 'flagged') {
    expect(hasError(r)).toBe(true);
  } else {
    // Empty only for fields that are not required, and never with an error (Req 5.3).
    expect(field.required).toBe(false);
    expect(hasError(r)).toBe(false);
  }
}

describe('P1: every required field is filled or flagged', () => {
  it('holds for any form, any answers and any signature set', () => {
    fc.assert(
      fc.property(mappingInputArb(), validationContextArb(), ([form, answers, signatures], ctx) => {
        const r = mapAnswers(form, answers, signatures, ctx);
        expect(r.formId).toBe(form.id);
        expect(Object.keys(r.fields).sort()).toEqual(form.fields.map((f) => f.id).sort());
        for (const field of form.fields) expectFieldRules(field, r.fields[field.id], signatures.has(field.id), ctx);
      }),
    );
  });

  it('with no answers, flags each required field with required-missing or signature-missing (Req 5.2, 5.4)', () => {
    const input = formModelArb().chain((form) => fc.tuple(fc.constant(form), signaturesArb(form)));
    fc.assert(
      fc.property(input, validationContextArb(), ([form, signatures], ctx) => {
        const r = mapAnswers(form, [], signatures, ctx);
        for (const field of form.fields) {
          const f = r.fields[field.id];
          const signed = field.type === 'signature' && signatures.has(field.id);
          if (!field.required || field.type === 'photo' || signed) continue;
          const code = field.type === 'signature' ? 'signature-missing' : 'required-missing';
          expect(f).toEqual({ fieldId: field.id, status: 'flagged', issues: [{ fieldId: field.id, code, severity: 'error' }] });
        }
      }),
    );
  });

  it('reaches filled, flagged and empty, and fills fields from free text, so P1 is not vacuous', () => {
    const samples = fc.sample(fc.tuple(mappingInputArb(), validationContextArb()), { numRuns: 300, seed: 11 });
    const statuses = new Set<string>();
    let filledFromFreeText = 0;
    for (const [[form, answers, signatures], ctx] of samples) {
      const r = mapAnswers(form, answers, signatures, ctx);
      const prompted = new Set(answers.map((a) => a.promptedFieldId));
      for (const f of Object.values(r.fields)) {
        if (form.fields.find((x) => x.id === f.fieldId)?.required) statuses.add(f.status);
        if (f.status === 'filled' && f.provenance !== undefined && !prompted.has(f.fieldId)) filledFromFreeText += 1;
      }
    }
    expect(statuses).toEqual(new Set(['filled', 'flagged', 'empty']));
    expect(filledFromFreeText).toBeGreaterThan(0);
  });
});

/** Issue codes that may disappear when a result is mapped again from its prompted answers. */
const MAY_DROP = new Set(['date-two-digit-year', 'free-text-ignored']);

describe('P4: mapping is deterministic and idempotent', () => {
  it('gives an equal result for the same input (Req 6.1)', () => {
    fc.assert(
      fc.property(mappingInputArb(), validationContextArb(), ([form, answers, signatures], ctx) => {
        expect(mapAnswers(form, answers, signatures, ctx)).toEqual(mapAnswers(form, answers, signatures, ctx));
      }),
    );
  });

  it('mapping toPromptedAnswers of a result again keeps every field and adds no issue (Req 6.2)', () => {
    fc.assert(
      fc.property(mappingInputArb(), validationContextArb(), ([form, answers, signatures], ctx) => {
        const first = mapAnswers(form, answers, signatures, ctx);
        const prompted = toPromptedAnswers(first);
        const again = mapAnswers(form, prompted, signatures, ctx);
        expect(again.formId).toBe(first.formId);
        expect(again.unmatched).toEqual([]);
        for (const field of form.fields) {
          const a = first.fields[field.id];
          const b = again.fields[field.id];
          const { issues: issuesA, ...restA } = a ?? { issues: [] };
          const { issues: issuesB, ...restB } = b ?? { issues: [] };
          expect(restB).toEqual(restA);
          for (const i of issuesB) expect(issuesA).toContainEqual(i);
          for (const i of issuesA) if (!MAY_DROP.has(i.code)) expect(issuesB).toContainEqual(i);
        }
        expect(toPromptedAnswers(again)).toEqual(prompted);
      }),
    );
  });
});
