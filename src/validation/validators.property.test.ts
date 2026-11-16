// Validator properties (validation Req 3.5, 4.1, 5.3; support P1, P4 and P5).
// - Totality (Req 5.3): validateField returns a well-formed outcome and never throws, for any
//   field and any string, including lone surrogates and text past the 200-character limit.
// - Idempotence (Req 3.5): if a raw answer validates to a value, validating that value again
//   returns the same value with no new issue. P4 (mapping idempotence) relies on this.
// - Required (Req 4.1): a required field never gets "no answer". P1 relies on this.
// Fields and answers are generated demo data (SAMPLE / DEMO DATA).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { FormField } from '../form-model/types';
import { anyStringArb, fieldArb, rawForFieldArb, validationContextArb } from './arbitraries';
import { SEVERITY } from './issues';
import { validateField, type ValidationOutcome } from './validators';

function expectWellFormed(field: FormField, r: ValidationOutcome): void {
  for (const i of r.issues) {
    expect(i.fieldId).toBe(field.id);
    expect(i.severity).toBe(SEVERITY[i.code]);
    for (const v of Object.values(i.params ?? {})) expect(typeof v).toBe('string');
  }
  const errors = r.issues.filter((i) => i.severity === 'error');
  if (r.ok) {
    expect(typeof r.value).toBe('string');
    expect(errors).toEqual([]);
  } else {
    expect(errors.length).toBeGreaterThan(0);
    expect('value' in r).toBe(false);
  }
}

const fieldWithRaw = fieldArb().chain((field) => fc.tuple(fc.constant(field), rawForFieldArb(field)));

describe('validateField totality (Req 5.3)', () => {
  it('returns a well-formed outcome for any field and any string', () => {
    fc.assert(
      fc.property(fieldArb(), anyStringArb(), validationContextArb(), (field, raw, ctx) => {
        expectWellFormed(field, validateField(field, raw, ctx));
      }),
    );
  });

  it('returns a well-formed outcome for answers aimed at the field', () => {
    fc.assert(
      fc.property(fieldWithRaw, validationContextArb(), ([field, raw], ctx) => {
        expectWellFormed(field, validateField(field, raw, ctx));
      }),
    );
  });
});

describe('validateField idempotence (Req 3.5)', () => {
  it('validating a normalised value returns the same value with no new issue', () => {
    fc.assert(
      fc.property(fieldWithRaw, validationContextArb(), ([field, raw], ctx) => {
        const first = validateField(field, raw, ctx);
        if (!first.ok) return;
        const again = validateField(field, first.value, ctx);
        expect(again.ok).toBe(true);
        if (!again.ok) return;
        expect(again.value).toBe(first.value);
        for (const i of again.issues) expect(first.issues).toContainEqual(i);
      }),
    );
  });

  it('reaches the "ok" branch for every field type, so the property above is not vacuous', () => {
    const samples = fc.sample(fc.tuple(fieldWithRaw, validationContextArb()), { numRuns: 3000, seed: 7 });
    const okTypes = new Set(
      samples.filter(([[field, raw], ctx]) => validateField(field, raw, ctx).ok).map(([[field]]) => field.type),
    );
    expect(okTypes).toEqual(new Set(['text', 'date', 'number', 'choice', 'checkbox', 'signature', 'photo']));
  });

  it('every option of a choice field, as printed or without its hint, gives an option that validates to itself', () => {
    fc.assert(
      fc.property(fieldArb(['choice']), validationContextArb(), (field, ctx) => {
        for (const option of field.choices ?? []) {
          for (const raw of [option, option.replace(/\s*\([^()]*\)$/u, '')]) {
            const first = validateField(field, raw, ctx);
            if (!first.ok || first.value === '') continue;
            expect(field.choices).toContain(first.value);
            expect(validateField(field, first.value, ctx)).toEqual(first);
          }
        }
      }),
    );
  });
});

describe('required fields (Req 4.1, supports P1)', () => {
  it('a required field is never "no answer": it gets a value or an error, except photo fields', () => {
    fc.assert(
      fc.property(fieldArb(), anyStringArb(), validationContextArb(), (base, raw, ctx) => {
        const field = { ...base, required: true };
        const r = validateField(field, raw, ctx);
        if (field.type === 'photo') {
          expect(r).toEqual({ ok: true, value: '', issues: [{ fieldId: field.id, code: 'photo-paste-after-print', severity: 'info' }] });
        } else if (r.ok) {
          expect(r.value).not.toBe('');
        }
      }),
    );
  });
});
