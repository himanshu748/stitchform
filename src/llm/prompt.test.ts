// Tests for buildRequest (llm-adapter Req 3.2): once serialised, the request holds field IDs,
// labels, types, required flags, choice options and answer text only. No bounding box, page,
// date role, answer source or order number, and nothing a caller attached to the objects.
// The form and answers are SAMPLE / DEMO DATA.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Answer, FormField, FormModel } from '../form-model';
import { ID_NOT_ON_FORM, mappingInputArb } from '../mapping/arbitraries';
import { buildRequest } from './prompt';

/** Every key path the serialised request may contain. */
const ALLOWED_PATHS = [
  'answers',
  'answers[].lang',
  'answers[].promptedFieldId',
  'answers[].text',
  'fields',
  'fields[].choices',
  'fields[].id',
  'fields[].label',
  'fields[].required',
  'fields[].type',
];

/** The key paths of a JSON value, for example "fields[].id". */
function keyPaths(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const p = path === '' ? k : `${path}.${k}`;
    return [p, ...keyPaths(v, p)];
  });
}

/** The values at the leaves of a JSON value. */
function leaves(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(leaves);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(leaves);
  return [value];
}

const serialised = (form: FormModel, answers: readonly Answer[]): unknown => JSON.parse(JSON.stringify(buildRequest(form, answers)));

function field(id: string, label: string, type: FormField['type'], extra: Partial<FormField> = {}): FormField {
  return { id, label, type, required: true, bbox: { x: 0.1, y: 0.2, w: 0.5, h: 0.05 }, page: 0, ...extra };
}

const form: FormModel = {
  id: 'sample-hollowbrook-hostel',
  title: 'Hollowbrook Residential Hostel (fictional) (SAMPLE / DEMO DATA)',
  source: 'sample',
  pages: [
    { index: 0, widthPt: 595.28, heightPt: 841.89 },
    { index: 1, widthPt: 595.28, heightPt: 841.89 },
  ],
  fields: [
    field('full-name', 'Full name', 'text'),
    field('city', 'शहर', 'text', { required: false }),
    field('dob', 'Date of birth', 'date', { dateRole: 'dob' }),
    field('room-type', 'Room type', 'choice', { choices: ['Shared (demo)', 'Single (demo)'] }),
    field('declaration', 'Declaration', 'checkbox', { page: 1 }),
    field('photo', 'Photo', 'photo', { required: false, page: 1 }),
    field('signature', 'Signature', 'signature', { page: 1 }),
  ],
};

const answers: Answer[] = [
  { text: 'room type single', source: 'voice', lang: 'en', seq: 4 },
  { text: 'Demo Applicant', source: 'typed', lang: 'en', promptedFieldId: 'full-name', seq: 1 },
  { text: '14/08/2005', source: 'stitch-code', lang: 'en', promptedFieldId: 'dob', seq: 2 },
  { text: 'नमूना नगर', source: 'voice', lang: 'hi', promptedFieldId: 'city', seq: 2 },
  { text: 'demo text for a field this form does not have', source: 'typed', lang: 'en', promptedFieldId: ID_NOT_ON_FORM, seq: 3 },
];

describe('buildRequest (Req 3.2)', () => {
  it('sends field IDs, labels, types, required flags, choice options and answer text only', () => {
    expect(buildRequest(form, answers)).toEqual({
      fields: [
        { id: 'full-name', label: 'Full name', type: 'text', required: true },
        { id: 'city', label: 'शहर', type: 'text', required: false },
        { id: 'dob', label: 'Date of birth', type: 'date', required: true },
        { id: 'room-type', label: 'Room type', type: 'choice', required: true, choices: ['Shared (demo)', 'Single (demo)'] },
        { id: 'declaration', label: 'Declaration', type: 'checkbox', required: true },
        { id: 'photo', label: 'Photo', type: 'photo', required: false },
        { id: 'signature', label: 'Signature', type: 'signature', required: true },
      ],
      // seq order; the two answers with seq 2 keep their input order.
      answers: [
        { text: 'Demo Applicant', lang: 'en', promptedFieldId: 'full-name' },
        { text: '14/08/2005', lang: 'en', promptedFieldId: 'dob' },
        { text: 'नमूना नगर', lang: 'hi', promptedFieldId: 'city' },
        // A prompt for a field this form does not have goes as free text, as in the mapper.
        { text: 'demo text for a field this form does not have', lang: 'en' },
        { text: 'room type single', lang: 'en' },
      ],
    });
  });

  it('serialises to exactly the allowed key paths, with no numbers anywhere', () => {
    const json = serialised(form, answers);
    expect([...new Set(keyPaths(json))].sort()).toEqual(ALLOWED_PATHS);
    expect(leaves(json).every((v) => typeof v === 'string' || typeof v === 'boolean')).toBe(true);
  });

  it('for any form and answers, sends only allowed keys, string or boolean values, and every field once', () => {
    fc.assert(
      fc.property(mappingInputArb(), ([f, a]) => {
        const json = serialised(f, a);
        const allowed = new Set(ALLOWED_PATHS);
        expect(keyPaths(json).filter((p) => !allowed.has(p))).toEqual([]);
        expect(leaves(json).filter((v) => typeof v !== 'string' && typeof v !== 'boolean')).toEqual([]);
        const req = buildRequest(f, a);
        expect(req.fields.map((x) => x.id)).toEqual(f.fields.map((x) => x.id));
        expect(req.fields.filter((x) => x.choices !== undefined).every((x) => x.type === 'choice')).toBe(true);
        expect(req.answers).toHaveLength(a.length);
        const ids = new Set(f.fields.map((x) => x.id));
        expect(req.answers.every((x) => x.promptedFieldId === undefined || ids.has(x.promptedFieldId))).toBe(true);
      }),
    );
  });

  it('leaves out anything else a caller attached to a field or an answer', () => {
    const extra = {
      image: 'demo-form-image-data',
      signatureImage: 'demo-signature-image-data',
      stitchCode: [83, 70, 1],
      passphrase: 'demo lantern stitch hollow brook',
    };
    const leaky: FormModel = { ...form, fields: form.fields.map((f) => ({ ...f, ...extra }) as FormField) };
    const leakyAnswers = answers.map((a) => ({ ...a, ...extra }) as Answer);
    const json = serialised(leaky, leakyAnswers);
    expect([...new Set(keyPaths(json))].sort()).toEqual(ALLOWED_PATHS);
    const text = JSON.stringify(json);
    for (const value of ['demo-form-image-data', 'demo-signature-image-data', 'demo lantern stitch hollow brook', 'Hollowbrook']) {
      expect(text).not.toContain(value);
    }
  });

  it('copies choice options, so changing the request cannot change the form', () => {
    const req = buildRequest(form, answers);
    req.fields[3]?.choices?.push('Demo extra option');
    expect(form.fields[3]?.choices).toEqual(['Shared (demo)', 'Single (demo)']);
  });
});
