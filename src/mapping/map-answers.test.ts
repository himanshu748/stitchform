import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Answer, FormField, FormModel } from '../form-model';
import type { ValidationContext } from '../validation';
import { mapAnswers, toPromptedAnswers } from './map-answers';

// Fictional demo form, demo people and demo values only (SAMPLE / DEMO DATA).
const ctx: ValidationContext = { today: { y: 2026, m: 11, d: 16 }, lang: 'en' };

function field(id: string, label: string, type: FormField['type'], required = true, extra: Partial<FormField> = {}): FormField {
  return { id, label, type, required, bbox: { x: 0, y: 0, w: 0.5, h: 0.05 }, page: 0, ...extra };
}

const form: FormModel = {
  id: 'sample-hollowbrook-hostel',
  title: 'Hollowbrook Residential Hostel (fictional) (SAMPLE / DEMO DATA)',
  source: 'sample',
  pages: [{ index: 0, widthPt: 595.28, heightPt: 841.89 }],
  fields: [
    field('full-name', 'Full name', 'text'),
    field('dob', 'Date of birth', 'date', true, { dateRole: 'dob' }),
    field('address', 'Address', 'text', false),
    field('emergency-contact-phone', 'Emergency contact phone', 'number'),
    field('id-type', 'ID type', 'choice', true, { choices: ['Sample ID card', 'Sample student card'] }),
    field('declaration', 'Declaration', 'checkbox', false),
    field('photo', 'Photo', 'photo'),
    field('signature', 'Signature', 'signature'),
  ],
};

let seq = 0;
function prompted(promptedFieldId: string, text: string, source: Answer['source'] = 'typed'): Answer {
  return { text, source, lang: 'en', promptedFieldId, seq: seq++ };
}
function free(text: string, source: Answer['source'] = 'voice'): Answer {
  return { text, source, lang: 'en', seq: seq++ };
}

const none = new Set<string>();

describe('mapAnswers: field statuses with no answers (Req 5.2, 5.3, 5.4, 5.5)', () => {
  it('flags required fields, leaves optional ones empty, and lists every field in form order', () => {
    const r = mapAnswers(form, [], none, ctx);
    expect(r.formId).toBe(form.id);
    expect(r.unmatched).toEqual([]);
    expect(Object.keys(r.fields)).toEqual(form.fields.map((f) => f.id));
    expect(r.fields['full-name']).toEqual({ fieldId: 'full-name', status: 'flagged', issues: [{ fieldId: 'full-name', code: 'required-missing', severity: 'error' }] });
    expect(r.fields.address).toEqual({ fieldId: 'address', status: 'empty', issues: [] });
    expect(r.fields.declaration).toEqual({ fieldId: 'declaration', status: 'empty', issues: [] });
    expect(r.fields.signature).toEqual({ fieldId: 'signature', status: 'flagged', issues: [{ fieldId: 'signature', code: 'signature-missing', severity: 'error' }] });
    expect(r.fields.photo).toEqual({ fieldId: 'photo', status: 'empty', issues: [{ fieldId: 'photo', code: 'photo-paste-after-print', severity: 'info' }] });
  });

  it('fills a signature field only from the signatures set, never from text (Req 5.4)', () => {
    const typed = mapAnswers(form, [prompted('signature', 'Asha Verma'), free('Signature: Asha Verma')], none, ctx);
    expect(typed.fields.signature?.status).toBe('flagged');
    expect(typed.fields.signature?.issues.map((i) => i.code)).toEqual(['signature-missing']);
    const drawn = mapAnswers(form, [], new Set(['signature']), ctx);
    expect(drawn.fields.signature).toEqual({ fieldId: 'signature', status: 'filled', value: 'signed', issues: [] });
  });

  it('never fills a photo field, even when the user answers it (Req 5.5)', () => {
    const r = mapAnswers(form, [prompted('photo', 'my photo')], none, ctx);
    expect(r.fields.photo).toEqual({ fieldId: 'photo', status: 'empty', issues: [{ fieldId: 'photo', code: 'photo-paste-after-print', severity: 'info' }] });
  });
});

describe('mapAnswers: prompted answers (Req 3.1 to 3.4)', () => {
  it('fills each prompted field with its normalised value and keeps the answer source', () => {
    const r = mapAnswers(
      form,
      [prompted('full-name', '  Asha   Verma '), prompted('dob', '५ मार्च २००४', 'voice'), prompted('emergency-contact-phone', '98765 43210'), prompted('id-type', 'student card')],
      none,
      ctx,
    );
    expect(r.fields['full-name']).toEqual({ fieldId: 'full-name', status: 'filled', value: 'Asha Verma', provenance: 'typed', issues: [] });
    expect(r.fields.dob).toEqual({ fieldId: 'dob', status: 'filled', value: '05/03/2004', provenance: 'voice', issues: [] });
    expect(r.fields['emergency-contact-phone']?.value).toBe('9876543210');
    expect(r.fields['id-type']?.value).toBe('Sample student card');
  });

  it('keeps warnings on a filled field', () => {
    const r = mapAnswers(form, [prompted('dob', '5-3-04')], none, ctx);
    expect(r.fields.dob).toEqual({
      fieldId: 'dob',
      status: 'filled',
      value: '05/03/2004',
      provenance: 'typed',
      issues: [{ fieldId: 'dob', code: 'date-two-digit-year', severity: 'warning' }],
    });
  });

  it('flags a value that fails its validator and keeps the raw text for editing', () => {
    const r = mapAnswers(form, [prompted('dob', '31/02/2004', 'voice'), prompted('emergency-contact-phone', 'nine eight')], none, ctx);
    expect(r.fields.dob).toEqual({ fieldId: 'dob', status: 'flagged', raw: '31/02/2004', provenance: 'voice', issues: [{ fieldId: 'dob', code: 'date-impossible', severity: 'error' }] });
    expect(r.fields['emergency-contact-phone']).toMatchObject({ status: 'flagged', raw: 'nine eight' });
  });

  it('uses the latest answer by seq, whatever the array order', () => {
    const later = { ...prompted('full-name', 'Ravi Kumar (demo)'), seq: 20 };
    const earlier = { ...prompted('full-name', 'Asha Verma'), seq: 10 };
    expect(mapAnswers(form, [later, earlier], none, ctx).fields['full-name']?.value).toBe('Ravi Kumar (demo)');
  });

  it('keeps input order for answers with the same seq, so the last one listed wins', () => {
    const a = { ...prompted('full-name', 'Asha Verma'), seq: 5 };
    const b = { ...prompted('full-name', 'Ravi Kumar (demo)'), seq: 5 };
    expect(mapAnswers(form, [a, b], none, ctx).fields['full-name']?.value).toBe('Ravi Kumar (demo)');
    expect(mapAnswers(form, [b, a], none, ctx).fields['full-name']?.value).toBe('Asha Verma');
  });

  it('lets a later blank answer clear a field', () => {
    const r = mapAnswers(form, [prompted('address', '12 Lantern Lane'), prompted('address', '  '), prompted('full-name', '')], none, ctx);
    expect(r.fields.address).toEqual({ fieldId: 'address', status: 'empty', issues: [] });
    expect(r.fields['full-name']).toEqual({ fieldId: 'full-name', status: 'flagged', issues: [{ fieldId: 'full-name', code: 'required-missing', severity: 'error' }] });
  });

  it('puts an answer for a field the form does not have into unmatched', () => {
    const r = mapAnswers(form, [prompted('blood-group', ' O positive '), prompted('blood-group', '   ')], none, ctx);
    expect(r.unmatched).toEqual(['O positive']);
  });
});

describe('mapAnswers: free text (Req 4.1, 4.3, 4.4)', () => {
  it('fills fields named in one free-text answer', () => {
    const r = mapAnswers(form, [free('My name is Asha Verma, date of birth 5 March 2004, address 12 Lantern Lane.')], none, ctx);
    expect(r.fields['full-name']).toEqual({ fieldId: 'full-name', status: 'filled', value: 'Asha Verma', provenance: 'voice', issues: [] });
    expect(r.fields.dob?.value).toBe('05/03/2004');
    expect(r.fields.address?.value).toBe('12 Lantern Lane');
    expect(r.unmatched).toEqual([]);
  });

  it('fills fields from a Hindi answer', () => {
    const r = mapAnswers(form, [{ ...free('मेरा नाम आशा वर्मा है, जन्म तिथि पाँच मार्च दो हज़ार चार'), lang: 'hi' }], none, ctx);
    expect(r.fields['full-name']?.value).toBe('आशा वर्मा');
    expect(r.fields.dob?.value).toBe('05/03/2004');
  });

  it('keeps a prompted answer over free text and adds one free-text-ignored warning', () => {
    const answers = [prompted('full-name', 'Asha Verma'), free('name Ravi Kumar'), free('my name is Meera Das')];
    const r = mapAnswers(form, answers, none, ctx);
    expect(r.fields['full-name']).toEqual({
      fieldId: 'full-name',
      status: 'filled',
      value: 'Asha Verma',
      provenance: 'typed',
      issues: [{ fieldId: 'full-name', code: 'free-text-ignored', severity: 'warning' }],
    });
  });

  it('a prompted answer wins even when the free text came later', () => {
    const r = mapAnswers(form, [free('address 7 Old Mill Road'), prompted('address', '12 Lantern Lane')], none, ctx);
    expect(r.fields.address?.value).toBe('12 Lantern Lane');
    const r2 = mapAnswers(form, [prompted('address', '12 Lantern Lane'), free('address 7 Old Mill Road')], none, ctx);
    expect(r2.fields.address?.value).toBe('12 Lantern Lane');
  });

  it('uses the latest free-text value when free text names a field twice', () => {
    const r = mapAnswers(form, [free('address 7 Old Mill Road'), free('address 12 Lantern Lane')], none, ctx);
    expect(r.fields.address?.value).toBe('12 Lantern Lane');
  });

  it('flags an invalid free-text value with its raw text', () => {
    const r = mapAnswers(form, [free('date of birth 31 February 2004')], none, ctx);
    expect(r.fields.dob).toMatchObject({ status: 'flagged', raw: '31 February 2004', provenance: 'voice' });
  });

  it('collects text before the first label in unmatched', () => {
    const r = mapAnswers(form, [free('hello there, name Asha Verma')], none, ctx);
    expect(r.unmatched).toEqual(['hello there']);
    expect(r.fields['full-name']?.value).toBe('Asha Verma');
  });
});

describe('toPromptedAnswers (Req 6.2)', () => {
  const answers = [
    free('name Asha Verma, date of birth 5-3-04', 'voice'),
    prompted('address', '12 Lantern Lane'),
    free('address 7 Old Mill Road'),
    prompted('emergency-contact-phone', 'nine eight'),
    prompted('id-type', 'पता नहीं'),
    prompted('blood-group', 'O positive'),
  ];

  it('emits filled values and flagged raw text, skipping empty, photo and signature fields', () => {
    const r = mapAnswers(form, answers, new Set(['signature']), ctx);
    expect(toPromptedAnswers(r)).toEqual([
      { text: 'Asha Verma', source: 'voice', lang: 'en', promptedFieldId: 'full-name', seq: 0 },
      { text: '05/03/2004', source: 'voice', lang: 'en', promptedFieldId: 'dob', seq: 1 },
      { text: '12 Lantern Lane', source: 'typed', lang: 'en', promptedFieldId: 'address', seq: 2 },
      { text: 'nine eight', source: 'typed', lang: 'en', promptedFieldId: 'emergency-contact-phone', seq: 3 },
      { text: 'पता नहीं', source: 'typed', lang: 'hi', promptedFieldId: 'id-type', seq: 4 },
    ]);
  });

  it('maps back to the same fields; only warnings about how an answer was written drop out', () => {
    const signatures = new Set(['signature']);
    const first = mapAnswers(form, answers, signatures, ctx);
    const again = mapAnswers(form, toPromptedAnswers(first), signatures, ctx);
    expect(again.unmatched).toEqual([]);
    expect(first.fields.dob?.issues.map((i) => i.code)).toEqual(['date-two-digit-year']);
    expect(first.fields.address?.issues.map((i) => i.code)).toEqual(['free-text-ignored']);
    expect(again.fields).toEqual({
      ...first.fields,
      dob: { ...first.fields.dob, issues: [] },
      address: { ...first.fields.address, issues: [] },
    });
  });
});

describe('mapAnswers: purity and privacy (Req 6.1, 6.3, 7.1, 7.2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('gives the same result for the same input and does not change its arguments', () => {
    const answers = [free('name Asha Verma, date of birth 5-3-04'), prompted('id-type', 'Sample ID card')];
    const frozen = structuredClone(answers);
    const formCopy = structuredClone(form);
    const a = mapAnswers(form, answers, new Set(['signature']), ctx);
    const b = mapAnswers(form, answers, new Set(['signature']), ctx);
    expect(a).toEqual(b);
    expect(answers).toEqual(frozen);
    expect(form).toEqual(formCopy);
  });

  it('makes no network request, touches no storage and logs nothing', () => {
    const touched = new Proxy({}, { get: () => { throw new Error('storage touched'); } });
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network used')));
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('localStorage', touched);
    vi.stubGlobal('sessionStorage', touched);
    vi.stubGlobal('indexedDB', touched);
    vi.stubGlobal('document', touched);
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    mapAnswers(form, [free('name Asha Verma, date of birth 5 March 2004'), prompted('dob', '31/02/2004')], none, ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const spy of logs) expect(spy).not.toHaveBeenCalled();
  });
});
