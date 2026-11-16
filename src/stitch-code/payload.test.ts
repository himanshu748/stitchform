import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { MappingResult } from '../form-model';
import { SIGNATURE_PRESENT } from '../validation';
import { fromPayload, payloadFromResult, toAnswers, toPayload, type StitchAnswer } from './payload';

// SAMPLE / DEMO DATA: a fictional form and invented answers.
const result: MappingResult = {
  formId: 'sample-hollowbrook-hostel',
  fields: {
    'full-name': { fieldId: 'full-name', status: 'filled', value: 'Demo Applicant', provenance: 'voice', issues: [] },
    city: { fieldId: 'city', status: 'filled', value: 'नमूना नगर', provenance: 'typed', issues: [] },
    dob: {
      fieldId: 'dob',
      status: 'flagged',
      raw: '31/02/2005',
      provenance: 'typed',
      issues: [{ fieldId: 'dob', code: 'date-impossible', severity: 'error' }],
    },
    address: { fieldId: 'address', status: 'empty', issues: [] },
    photo: { fieldId: 'photo', status: 'empty', issues: [{ fieldId: 'photo', code: 'photo-paste-after-print', severity: 'info' }] },
    signature: { fieldId: 'signature', status: 'filled', value: SIGNATURE_PRESENT, issues: [] },
  },
  unmatched: ['demo words that matched no field'],
};

const decode = (b: Uint8Array): string => new TextDecoder().decode(b);
const encode = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('payload content (Req 3.1, 3.2)', () => {
  it('keeps only the form ID and the text entered per field, in field order', () => {
    expect(payloadFromResult(result)).toEqual({
      formId: 'sample-hollowbrook-hostel',
      answers: [
        ['full-name', 'Demo Applicant'],
        ['city', 'नमूना नगर'],
        ['dob', '31/02/2005'],
      ],
    });
  });

  it('never includes signature, photo or empty fields, unmatched text or provenance', () => {
    const json = decode(toPayload(result.formId, payloadFromResult(result).answers));
    expect(json).not.toContain('signature');
    expect(json).not.toContain(SIGNATURE_PRESENT);
    expect(json).not.toContain('photo');
    expect(json).not.toContain('address');
    expect(json).not.toContain('demo words');
    expect(json).not.toContain('voice');
  });

  it('writes the version 1 JSON shape from the design', () => {
    const answers: StitchAnswer[] = [['full-name', 'Demo "Q" Applicant']];
    expect(decode(toPayload('sample-demo', answers))).toBe('{"v":1,"f":"sample-demo","a":[["full-name","Demo \\"Q\\" Applicant"]]}');
    expect(decode(toPayload('sample-demo', []))).toBe('{"v":1,"f":"sample-demo","a":[]}');
  });
});

describe('fromPayload (Req 5.1, 5.2)', () => {
  it('reads back any form ID and answers exactly, even with lone surrogate halves', () => {
    const text = fc.string({ unit: 'binary', maxLength: 40 });
    fc.assert(
      fc.property(text, fc.array(fc.tuple(text, text), { maxLength: 8 }), (formId, answers) => {
        const back = fromPayload(toPayload(formId, answers));
        expect(back).toEqual({ ok: true, payload: { formId, answers } });
      }),
    );
  });

  it.each([
    ['invalid UTF-8', Uint8Array.of(0x7b, 0xff, 0x7d)],
    ['empty bytes', new Uint8Array(0)],
    ['text that is not JSON', encode('not json')],
    ['a JSON array', encode('[1,"f",[]]')],
    ['JSON null', encode('null')],
    ['another version', encode('{"v":2,"f":"sample-demo","a":[]}')],
    ['the version as a string', encode('{"v":"1","f":"sample-demo","a":[]}')],
    ['a missing form ID', encode('{"v":1,"a":[]}')],
    ['a form ID that is not a string', encode('{"v":1,"f":7,"a":[]}')],
    ['answers that are not a list', encode('{"v":1,"f":"sample-demo","a":{}}')],
    ['an answer with one item', encode('{"v":1,"f":"sample-demo","a":[["full-name"]]}')],
    ['an answer with three items', encode('{"v":1,"f":"sample-demo","a":[["full-name","Demo","x"]]}')],
    ['an answer that is not text', encode('{"v":1,"f":"sample-demo","a":[["age",21]]}')],
    ['an extra key', encode('{"v":1,"f":"sample-demo","a":[],"k":"demo-key"}')],
  ])('rejects %s as bad-payload', (_name, bytes) => {
    expect(fromPayload(bytes)).toEqual({ ok: false, code: 'bad-payload' });
  });
});

describe('toAnswers (Req 5.1)', () => {
  it('gives one prompted answer per stored answer, marked as coming from the stitch code', () => {
    expect(toAnswers(payloadFromResult(result))).toEqual([
      { text: 'Demo Applicant', source: 'stitch-code', lang: 'en', promptedFieldId: 'full-name', seq: 0 },
      { text: 'नमूना नगर', source: 'stitch-code', lang: 'hi', promptedFieldId: 'city', seq: 1 },
      { text: '31/02/2005', source: 'stitch-code', lang: 'en', promptedFieldId: 'dob', seq: 2 },
    ]);
  });
});
