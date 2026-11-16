import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateFormModel } from '../form-model';
import { FIELD_TYPES, formModelArb } from './arbitraries';

describe('formModelArb', () => {
  it('only generates models that pass validateFormModel', () => {
    fc.assert(
      fc.property(formModelArb(), (m) => {
        const r = validateFormModel(m);
        if (!r.ok) throw new Error(r.errors.join('\n'));
        expect(m.fields.length).toBeGreaterThanOrEqual(1);
        expect(m.fields.length).toBeLessThanOrEqual(20);
      }),
    );
  });

  it('covers every field type, both required values and more than one page', () => {
    const models = fc.sample(formModelArb(), { numRuns: 200, seed: 42 });
    const fields = models.flatMap((m) => m.fields);
    expect(new Set(fields.map((f) => f.type))).toEqual(new Set(FIELD_TYPES));
    expect(new Set(fields.map((f) => f.required))).toEqual(new Set([true, false]));
    expect(models.some((m) => m.pages.length > 1)).toBe(true);
    expect(fields.some((f) => f.type === 'date' && f.dateRole === 'dob')).toBe(true);
  });
});
