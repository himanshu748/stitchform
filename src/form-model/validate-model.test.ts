import { describe, expect, it } from 'vitest';
import { addField, updateField, validateFormModel, type FormField, type FormModel } from './index';

// Fictional demo form used only by these tests (SAMPLE / DEMO DATA).
function demoForm(fields: FormField[]): FormModel {
  return {
    id: 'demo-form',
    title: 'Demo form (SAMPLE / DEMO DATA)',
    source: 'manual',
    pages: [
      { index: 0, widthPt: 595.28, heightPt: 841.89 },
      { index: 1, widthPt: 595.28, heightPt: 841.89 },
    ],
    fields,
  };
}

const nameField: FormField = {
  id: 'full-name',
  label: 'Full name',
  type: 'text',
  required: true,
  bbox: { x: 0.1, y: 0.1, w: 0.5, h: 0.05 },
  page: 0,
};

const choiceField: FormField = {
  id: 'id-type',
  label: 'ID type',
  type: 'choice',
  required: false,
  bbox: { x: 0.1, y: 0.2, w: 0.5, h: 0.05 },
  page: 1,
  choices: ['Sample ID card', 'Sample student card'],
};

function errorsOf(m: FormModel): string[] {
  const r = validateFormModel(m);
  return r.ok ? [] : r.errors;
}

describe('validateFormModel (Req 1.3)', () => {
  it('accepts a valid model', () => {
    expect(validateFormModel(demoForm([nameField, choiceField]))).toEqual({ ok: true });
  });

  it('accepts a box that touches the page edges exactly', () => {
    const edge = { ...nameField, bbox: { x: 0, y: 0, w: 1, h: 1 } };
    expect(validateFormModel(demoForm([edge]))).toEqual({ ok: true });
  });

  it('rejects duplicate IDs once per ID', () => {
    const errors = errorsOf(demoForm([nameField, { ...nameField }, { ...nameField }]));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"full-name"');
  });

  it.each([
    ['negative x', { x: -0.01, y: 0.1, w: 0.5, h: 0.05 }],
    ['x + w past the right edge', { x: 0.6, y: 0.1, w: 0.5, h: 0.05 }],
    ['y + h past the bottom edge', { x: 0.1, y: 0.99, w: 0.5, h: 0.05 }],
    ['h above 1', { x: 0, y: 0, w: 0.5, h: 1.5 }],
    ['NaN', { x: Number.NaN, y: 0.1, w: 0.5, h: 0.05 }],
    ['Infinity', { x: 0.1, y: 0.1, w: Number.POSITIVE_INFINITY, h: 0.05 }],
  ])('rejects a box with %s', (_name, bbox) => {
    const errors = errorsOf(demoForm([{ ...nameField, bbox }]));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/box/);
  });

  it.each([[2], [-1], [0.5]])('rejects page %s, which is not a page of the form', (page) => {
    const errors = errorsOf(demoForm([{ ...nameField, page }]));
    expect(errors).toEqual([`Field "full-name": page ${page} is not a page of this form.`]);
  });

  it('rejects a choice field with no options, missing options or a blank option', () => {
    const { choices: _drop, ...noChoices } = choiceField;
    expect(errorsOf(demoForm([noChoices]))).toHaveLength(1);
    expect(errorsOf(demoForm([{ ...choiceField, choices: [] }]))).toHaveLength(1);
    expect(errorsOf(demoForm([{ ...choiceField, choices: ['Sample ID card', '  '] }]))).toHaveLength(1);
  });

  it('rejects an ID outside [a-z0-9-]+', () => {
    expect(errorsOf(demoForm([{ ...nameField, id: 'Full Name' }]))).toHaveLength(1);
    expect(errorsOf(demoForm([{ ...nameField, id: '' }]))).toHaveLength(1);
  });

  it('reports every problem, not only the first', () => {
    const bad = { ...choiceField, id: 'id-type', page: 9, choices: [] as string[], bbox: { x: 2, y: 0, w: 0, h: 0 } };
    expect(errorsOf(demoForm([bad]))).toHaveLength(3);
  });
});

describe('addField (Req 2.2)', () => {
  it('adds a text field, not required, with a new unique ID', () => {
    const m = demoForm([nameField]);
    const next = addField(m, { bbox: { x: 0.1, y: 0.5, w: 0.3, h: 0.04 }, page: 0 });
    expect(next.fields).toHaveLength(2);
    const added = next.fields[1];
    expect(added).toMatchObject({ type: 'text', required: false, page: 0, label: '' });
    expect(added?.id).toMatch(/^[a-z0-9-]+$/);
    expect(added?.id).not.toBe('full-name');
    expect(validateFormModel(next)).toEqual({ ok: true });
  });

  it('ignores a requested ID and never reuses an existing one', () => {
    const m = demoForm([nameField, { ...nameField, id: 'field-2' }]);
    const next = addField(m, { id: 'full-name', bbox: { x: 0, y: 0, w: 0.1, h: 0.1 }, page: 1 });
    const ids = next.fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[2]).toBe('field-3');
  });

  it('does not change the input model', () => {
    const m = demoForm([nameField]);
    const before = structuredClone(m);
    addField(m, { label: 'Address', bbox: { x: 0, y: 0, w: 0.1, h: 0.1 }, page: 0 });
    expect(m).toEqual(before);
  });
});

describe('updateField (Req 2.1)', () => {
  it('changes label, type, required flag and box, and keeps the ID', () => {
    const m = demoForm([nameField, choiceField]);
    const next = updateField(m, 'full-name', {
      label: 'Date of birth',
      type: 'date',
      required: false,
      bbox: { x: 0.2, y: 0.3, w: 0.2, h: 0.05 },
      dateRole: 'dob',
    });
    expect(next.fields[0]).toEqual({
      id: 'full-name',
      label: 'Date of birth',
      type: 'date',
      required: false,
      bbox: { x: 0.2, y: 0.3, w: 0.2, h: 0.05 },
      page: 0,
      dateRole: 'dob',
    });
    expect(next.fields[1]).toBe(choiceField);
  });

  it('never changes the ID even if a patch tries to', () => {
    const m = demoForm([nameField]);
    const sneaky = { label: 'Name', id: 'other' } as Partial<Omit<FormField, 'id'>>;
    expect(updateField(m, 'full-name', sneaky).fields[0]?.id).toBe('full-name');
  });

  it('returns the model unchanged for an unknown ID and never mutates the input', () => {
    const m = demoForm([nameField]);
    const before = structuredClone(m);
    expect(updateField(m, 'missing', { label: 'x' })).toBe(m);
    updateField(m, 'full-name', { label: 'x' });
    expect(m).toEqual(before);
  });
});
