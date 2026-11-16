// Tests for mergeSuggestions and collectNotes (llm-adapter Req 5.1 to 5.4, design.md "Merge
// rules"). The rule-based result comes from mapAnswers, as in the app. The form, answers and
// suggested values are SAMPLE / DEMO DATA.

import { describe, expect, it } from 'vitest';
import type { Answer, FieldResult, FormField, FormModel, MappingResult } from '../form-model';
import { mapAnswers } from '../mapping';
import { SIGNATURE_PRESENT, type ValidationContext } from '../validation';
import { collectNotes, mergeSuggestions } from './merge';
import type { LlmSuggestion } from './types';

const ctx: ValidationContext = { today: { y: 2026, m: 11, d: 16 }, lang: 'en' };

function field(id: string, label: string, type: FormField['type'], extra: Partial<FormField> = {}): FormField {
  return { id, label, type, required: true, bbox: { x: 0, y: 0, w: 0.5, h: 0.05 }, page: 0, ...extra };
}

const form: FormModel = {
  id: 'sample-hollowbrook-hostel',
  title: 'Hollowbrook Residential Hostel (fictional) (SAMPLE / DEMO DATA)',
  source: 'sample',
  pages: [{ index: 0, widthPt: 595.28, heightPt: 841.89 }],
  fields: [
    field('full-name', 'Full name', 'text'),
    field('city', 'City', 'text', { required: false }),
    field('dob', 'Date of birth', 'date', { dateRole: 'dob' }),
    field('room-type', 'Room type', 'choice', { choices: ['Shared (demo)', 'Single (demo)'] }),
    field('room-number', 'Preferred room number', 'number', { required: false }),
    field('emergency-contact-phone', 'Emergency contact phone', 'number'),
    field('declaration', 'Declaration', 'checkbox'),
    field('photo', 'Photo', 'photo', { required: false }),
    field('signature', 'Signature', 'signature'),
  ],
};

const answers: Answer[] = [
  { text: 'Demo Applicant', source: 'typed', lang: 'en', promptedFieldId: 'full-name', seq: 0 },
  { text: 'नमूना नगर', source: 'voice', lang: 'hi', promptedFieldId: 'city', seq: 1 },
  { text: '31/02/2005', source: 'typed', lang: 'en', promptedFieldId: 'dob', seq: 2 },
  { text: 'yes', source: 'stitch-code', lang: 'en', promptedFieldId: 'declaration', seq: 3 },
];

const ruleResult = mapAnswers(form, answers, new Set(), ctx);
const merge = (suggestions: LlmSuggestion[], base: MappingResult = ruleResult): MappingResult => mergeSuggestions(form, base, suggestions, ctx);
const info = (fieldId: string, code: 'llm-suggestion' | 'llm-rejected') => ({ fieldId, code, severity: 'info' });

describe('the demo rule-based result', () => {
  it('has fields filled by each source, flagged and empty fields, as the merge tests assume', () => {
    expect(ruleResult.fields).toEqual({
      'full-name': { fieldId: 'full-name', status: 'filled', value: 'Demo Applicant', provenance: 'typed', issues: [] },
      city: { fieldId: 'city', status: 'filled', value: 'नमूना नगर', provenance: 'voice', issues: [] },
      dob: { fieldId: 'dob', status: 'flagged', raw: '31/02/2005', provenance: 'typed', issues: [{ fieldId: 'dob', code: 'date-impossible', severity: 'error' }] },
      'room-type': { fieldId: 'room-type', status: 'flagged', issues: [{ fieldId: 'room-type', code: 'required-missing', severity: 'error' }] },
      'room-number': { fieldId: 'room-number', status: 'empty', issues: [] },
      'emergency-contact-phone': {
        fieldId: 'emergency-contact-phone',
        status: 'flagged',
        issues: [{ fieldId: 'emergency-contact-phone', code: 'required-missing', severity: 'error' }],
      },
      declaration: { fieldId: 'declaration', status: 'filled', value: 'yes', provenance: 'stitch-code', issues: [] },
      photo: { fieldId: 'photo', status: 'empty', issues: [{ fieldId: 'photo', code: 'photo-paste-after-print', severity: 'info' }] },
      signature: { fieldId: 'signature', status: 'flagged', issues: [{ fieldId: 'signature', code: 'signature-missing', severity: 'error' }] },
    });
  });
});

describe('mergeSuggestions (Req 5.1 to 5.4)', () => {
  it('fills empty and flagged fields with values that pass the validator, normalised and marked llm (Req 5.1, 5.4)', () => {
    const r = merge([
      { fieldId: 'room-type', value: 'single' },
      { fieldId: 'emergency-contact-phone', value: '98765 43210' },
      { fieldId: 'room-number', value: '१२' },
      { fieldId: 'dob', value: '2005-08-14' },
    ]);
    expect(r.fields['room-type']).toEqual({ fieldId: 'room-type', status: 'filled', value: 'Single (demo)', provenance: 'llm', issues: [info('room-type', 'llm-suggestion')] });
    expect(r.fields['emergency-contact-phone']).toEqual({
      fieldId: 'emergency-contact-phone',
      status: 'filled',
      value: '9876543210',
      provenance: 'llm',
      issues: [info('emergency-contact-phone', 'llm-suggestion')],
    });
    expect(r.fields['room-number']).toEqual({ fieldId: 'room-number', status: 'filled', value: '12', provenance: 'llm', issues: [info('room-number', 'llm-suggestion')] });
    // A flagged answer the user typed may be filled (Req 5.3 allows flagged fields); the date is canonical.
    expect(r.fields.dob).toEqual({ fieldId: 'dob', status: 'filled', value: '14/08/2005', provenance: 'llm', issues: [info('dob', 'llm-suggestion')] });
  });

  it("keeps the validator's warnings next to llm-suggestion", () => {
    const r = merge([{ fieldId: 'dob', value: '14-08-05' }]);
    expect(r.fields.dob).toEqual({
      fieldId: 'dob',
      status: 'filled',
      value: '14/08/2005',
      provenance: 'llm',
      issues: [{ fieldId: 'dob', code: 'date-two-digit-year', severity: 'warning' }, info('dob', 'llm-suggestion')],
    });
  });

  it('keeps a field as it was and adds llm-rejected when the value fails its validator (Req 5.2)', () => {
    const r = merge([
      { fieldId: 'dob', value: '30/02/2005' },
      { fieldId: 'emergency-contact-phone', value: 'call the warden (demo)' },
      { fieldId: 'room-type', value: 'Deluxe suite (demo)' },
      { fieldId: 'room-number', value: 'twelve' },
    ]);
    for (const id of ['dob', 'emergency-contact-phone', 'room-type', 'room-number']) {
      const before = ruleResult.fields[id] as FieldResult;
      expect(r.fields[id]).toEqual({ ...before, issues: [...before.issues, info(id, 'llm-rejected')] });
    }
    // An empty field that is not required stays empty, with an info issue and no error.
    expect(r.fields['room-number']?.status).toBe('empty');
  });

  it('ignores suggestions for fields the form does not have (Req 5.2)', () => {
    const r = merge([
      { fieldId: 'demo-not-on-form', value: 'Demo value' },
      { fieldId: 'Room-Type', value: 'single' },
      { fieldId: '', value: 'single' },
      { fieldId: 'constructor', value: 'single' },
    ]);
    expect(r).toEqual(ruleResult);
  });

  it('never replaces a value the user typed, spoke or loaded from a stitch code (Req 5.3)', () => {
    const r = merge([
      { fieldId: 'full-name', value: 'Other Demo Name' },
      { fieldId: 'city', value: 'Demo Town' },
      { fieldId: 'declaration', value: 'no' },
    ]);
    expect(r).toEqual(ruleResult);
  });

  it('never sets a signature or photo field, not even with the signature marker (validation Req 4.3)', () => {
    const r = merge([
      { fieldId: 'signature', value: SIGNATURE_PRESENT },
      { fieldId: 'photo', value: 'demo-photo.png' },
    ]);
    expect(r).toEqual(ruleResult);
  });

  it('keeps a value an earlier suggestion filled', () => {
    const first = merge([{ fieldId: 'room-type', value: 'single' }]);
    const again = merge([{ fieldId: 'room-type', value: 'shared' }], first);
    expect(again).toEqual(first);
  });

  it('tries only the first non-blank value for a field and ignores blank values', () => {
    const r = merge([
      { fieldId: 'emergency-contact-phone', value: ' \n' },
      { fieldId: 'emergency-contact-phone', value: 'call the warden (demo)' },
      { fieldId: 'emergency-contact-phone', value: '12345' },
      { fieldId: 'room-type', value: '' },
      { fieldId: 'room-type', value: 'shared' },
    ]);
    expect(r.fields['emergency-contact-phone']?.issues).toEqual([
      { fieldId: 'emergency-contact-phone', code: 'required-missing', severity: 'error' },
      info('emergency-contact-phone', 'llm-rejected'),
    ]);
    expect(r.fields['room-type']).toMatchObject({ status: 'filled', value: 'Shared (demo)', provenance: 'llm' });
  });

  it('ignores notes, which collectNotes handles', () => {
    expect(merge([{ fieldId: 'dob', note: 'This date does not exist (demo).' }])).toEqual(ruleResult);
  });

  it('keeps every field once in form order, leaves its input unchanged and shares no object with it', () => {
    const before = structuredClone(ruleResult);
    const suggestions: LlmSuggestion[] = [{ fieldId: 'room-type', value: 'single' }, { fieldId: 'dob', value: 'never' }];
    const suggestionsBefore = structuredClone(suggestions);
    const r = merge(suggestions);
    expect(ruleResult).toEqual(before);
    expect(suggestions).toEqual(suggestionsBefore);
    expect(Object.keys(r.fields)).toEqual(form.fields.map((f) => f.id));
    expect(r.formId).toBe(ruleResult.formId);
    expect(r.unmatched).toEqual(ruleResult.unmatched);
    expect(r.unmatched).not.toBe(ruleResult.unmatched);
    for (const f of form.fields) {
      expect(r.fields[f.id]).not.toBe(ruleResult.fields[f.id]);
      expect(r.fields[f.id]?.issues).not.toBe(ruleResult.fields[f.id]?.issues);
    }
  });

  it('flags a required field the rule-based result left out, so P1 still holds (rule 5)', () => {
    const withConstructor: FormModel = { ...form, fields: [...form.fields, field('constructor', 'Demo field', 'text')] };
    const r = mergeSuggestions(withConstructor, { formId: form.id, fields: {}, unmatched: [] }, [{ fieldId: 'full-name', value: 'Demo Applicant' }], ctx);
    expect(r.fields['full-name']).toMatchObject({ status: 'filled', value: 'Demo Applicant', provenance: 'llm' });
    expect(r.fields.city).toEqual({ fieldId: 'city', status: 'empty', issues: [] });
    expect(r.fields.photo).toEqual({ fieldId: 'photo', status: 'empty', issues: [] });
    expect(r.fields.signature).toEqual({ fieldId: 'signature', status: 'flagged', issues: [{ fieldId: 'signature', code: 'signature-missing', severity: 'error' }] });
    for (const id of ['dob', 'room-type', 'emergency-contact-phone', 'declaration', 'constructor']) {
      expect(r.fields[id]).toEqual({ fieldId: id, status: 'flagged', issues: [{ fieldId: id, code: 'required-missing', severity: 'error' }] });
    }
  });

  it('puts no suggested value into an issue (validation Req 5.1)', () => {
    const values = ['Deluxe suite (demo)', 'call the warden (demo)', '30/02/2005', 'Other Demo Name'];
    const r = merge([
      { fieldId: 'room-type', value: values[0] },
      { fieldId: 'emergency-contact-phone', value: values[1] },
      { fieldId: 'dob', value: values[2] },
      { fieldId: 'full-name', value: values[3] },
    ] as LlmSuggestion[]);
    const issues = JSON.stringify(Object.values(r.fields).flatMap((f) => f.issues));
    for (const v of values) expect(issues).not.toContain(v);
  });
});

describe('collectNotes (Req 5.2, 5.3)', () => {
  it('keeps notes for fields of the form in reply order, normalised, and drops blank and repeated ones', () => {
    const notes = collectNotes(form, [
      { fieldId: 'dob', note: '  This date does not\n exist (demo).  ' },
      { fieldId: 'full-name', note: 'Check the spelling (demo).' },
      { fieldId: 'demo-not-on-form', note: 'Not on this form (demo).' },
      { fieldId: 'signature', note: '   ' },
      { fieldId: 'dob', note: 'This date does not exist (demo).' },
      { fieldId: 'dob', value: '14/08/2005' },
      { fieldId: 'constructor', note: 'Not on this form either (demo).' },
      { fieldId: 'signature', note: 'Please sign the form yourself (demo).' },
    ]);
    expect(notes).toEqual([
      { fieldId: 'dob', note: 'This date does not exist (demo).' },
      { fieldId: 'full-name', note: 'Check the spelling (demo).' },
      { fieldId: 'signature', note: 'Please sign the form yourself (demo).' },
    ]);
  });

  it('gives no notes for value suggestions only', () => {
    expect(collectNotes(form, [{ fieldId: 'dob', value: '14/08/2005' }])).toEqual([]);
  });
});
