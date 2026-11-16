import { describe, expect, it } from 'vitest';
import type { FormField } from '../form-model';
import { SIGNATURE_PRESENT, normaliseText, validateField, type ValidationContext } from './validators';

// Fictional demo fields and values only (SAMPLE / DEMO DATA).
const ctx: ValidationContext = { today: { y: 2026, m: 11, d: 16 }, lang: 'en' };

function field(type: FormField['type'], extra: Partial<FormField> = {}): FormField {
  return { id: `demo-${type}`, label: 'Demo', type, required: true, bbox: { x: 0, y: 0, w: 0.5, h: 0.05 }, page: 0, ...extra };
}

const codes = (r: ReturnType<typeof validateField>): string[] => r.issues.map((i) => `${i.severity}:${i.code}`);

describe('normaliseText (Req 3.1)', () => {
  it('trims, collapses whitespace, drops control characters and applies NFC', () => {
    expect(normaliseText('  Asha \t\n  Verma  ')).toBe('Asha Verma');
    expect(normaliseText('As\u0000ha')).toBe('Asha');
    expect(normaliseText('Re\u0301sume\u0301')).toBe('R\u00e9sum\u00e9');
    // A control character between a letter and a combining mark: NFC must run after removal.
    expect(normaliseText('e\u0000\u0301')).toBe('\u00e9');
  });
});

describe('required fields (Req 4.1)', () => {
  it.each(['text', 'number', 'date', 'choice', 'checkbox'] as const)('%s: empty gives required-missing when required', (type) => {
    const f = field(type, { choices: ['Band A (demo)'] });
    for (const raw of ['', '   ', '\n\t']) {
      expect(validateField(f, raw, ctx)).toEqual({ ok: false, issues: [{ fieldId: f.id, code: 'required-missing', severity: 'error' }] });
    }
  });

  it.each(['text', 'number', 'date', 'choice', 'checkbox'] as const)('%s: empty is "no answer" when not required', (type) => {
    expect(validateField(field(type, { required: false, choices: ['x'] }), ' ', ctx)).toEqual({ ok: true, value: '', issues: [] });
  });
});

describe('text (Req 3.1)', () => {
  it('returns the normalised text', () => {
    expect(validateField(field('text'), '  12   Lantern  Lane ', ctx)).toEqual({ ok: true, value: '12 Lantern Lane', issues: [] });
    expect(validateField(field('text'), 'आशा  वर्मा', ctx)).toEqual({ ok: true, value: 'आशा वर्मा', issues: [] });
  });
});

describe('number (Req 3.2)', () => {
  it.each([
    ['72', '72'],
    ['98765 43210', '9876543210'],
    ['९८७६५ ४३२१०', '9876543210'],
    ['007', '007'],
  ])('%j gives %j', (raw, value) => {
    expect(validateField(field('number'), raw, ctx)).toEqual({ ok: true, value, issues: [] });
  });

  it.each(['72.5', '12a', '+91 98765', '1,000', '-3', 'seventy'])('%j gives number-invalid', (raw) => {
    expect(codes(validateField(field('number'), raw, ctx))).toEqual(['error:number-invalid']);
  });
});

describe('date (Req 1, 2)', () => {
  const dob = field('date', { dateRole: 'dob' });

  it('normalises to DD/MM/YYYY with ASCII digits', () => {
    expect(validateField(field('date'), '2004-03-05', ctx)).toEqual({ ok: true, value: '05/03/2004', issues: [] });
    expect(validateField(field('date'), 'पाँच मार्च दो हज़ार चार', ctx)).toEqual({ ok: true, value: '05/03/2004', issues: [] });
    expect(validateField(field('date'), '०५/०३/२००४', ctx)).toEqual({ ok: true, value: '05/03/2004', issues: [] });
  });

  it('warns about a two-digit year and keeps the value', () => {
    const r = validateField(dob, '5-3-04', ctx);
    expect(r).toEqual({ ok: true, value: '05/03/2004', issues: [{ fieldId: dob.id, code: 'date-two-digit-year', severity: 'warning' }] });
  });

  it('rejects unreadable and impossible dates', () => {
    expect(codes(validateField(dob, 'next tuesday', ctx))).toEqual(['error:date-unparsed']);
    expect(codes(validateField(dob, '31/02/2004', ctx))).toEqual(['error:date-impossible']);
  });

  it('rejects a date of birth in the future, but not another future date', () => {
    expect(codes(validateField(dob, '01/01/2030', ctx))).toEqual(['error:dob-in-future']);
    expect(validateField(field('date'), '01/01/2030', ctx)).toEqual({ ok: true, value: '01/01/2030', issues: [] });
    expect(validateField(field('date', { dateRole: 'other' }), '01/01/2030', ctx).ok).toBe(true);
  });

  it('warns about a date of birth over 120 years ago and keeps it', () => {
    const r = validateField(dob, '01/01/1890', ctx);
    expect(r).toEqual({ ok: true, value: '01/01/1890', issues: [{ fieldId: dob.id, code: 'dob-implausible', severity: 'warning' }] });
  });
});

describe('choice (Req 3.3)', () => {
  const band = field('choice', { choices: ['Band A (demo)', 'Band B (demo)', 'Band C (demo)'] });
  const idType = field('choice', { choices: ['Sample ID card', 'Sample student card', 'Sample other document'] });

  it.each([
    [band, 'Band B (demo)', 'Band B (demo)'],
    [band, 'band b (DEMO)', 'Band B (demo)'],
    [band, 'Band B', 'Band B (demo)'],
    [band, 'b', 'Band B (demo)'],
    [band, 'बैंड सी', 'Band C (demo)'],
    [idType, 'student card', 'Sample student card'],
    [idType, 'पहचान पत्र', 'Sample ID card'],
    [idType, 'अन्य दस्तावेज़', 'Sample other document'],
    [idType, 'अन्य दस्तावेज', 'Sample other document'],
  ])('%#: %j gives the option label', (f, raw, value) => {
    expect(validateField(f, raw as string, ctx)).toEqual({ ok: true, value, issues: [] });
  });

  it('lists the options when nothing matches', () => {
    expect(validateField(band, 'Band Z', ctx)).toEqual({
      ok: false,
      issues: [{ fieldId: band.id, code: 'choice-unknown', severity: 'error', params: { options: 'Band A (demo), Band B (demo), Band C (demo)' } }],
    });
  });

  it('does not guess when two options shorten to the same words', () => {
    const f = field('choice', { choices: ['Band A (demo)', 'Band A (sample)'] });
    expect(codes(validateField(f, 'band a', ctx))).toEqual(['error:choice-unknown']);
    expect(validateField(f, 'Band A (sample)', ctx)).toEqual({ ok: true, value: 'Band A (sample)', issues: [] });
  });

  it('returns the first of two options that differ only in case', () => {
    const f = field('choice', { choices: ['Yes please', 'YES PLEASE'] });
    expect(validateField(f, 'YES PLEASE', ctx)).toEqual({ ok: true, value: 'Yes please', issues: [] });
  });

  it('is total for a choice field with no options', () => {
    const { choices: _drop, ...noOptions } = band;
    expect(validateField(noOptions, 'Band A', ctx)).toEqual({
      ok: false,
      issues: [{ fieldId: band.id, code: 'choice-unknown', severity: 'error', params: { options: '' } }],
    });
  });
});

describe('checkbox (Req 3.4)', () => {
  it.each(['yes', 'Yes.', 'Y', 'ticked', 'हाँ', 'हां', 'जी हाँ'])('%j is yes', (raw) => {
    expect(validateField(field('checkbox'), raw, ctx)).toEqual({ ok: true, value: 'yes', issues: [] });
  });

  it.each(['no', 'No!', 'नहीं', 'नही', 'ना'])('%j is no', (raw) => {
    expect(validateField(field('checkbox'), raw, ctx)).toEqual({ ok: true, value: 'no', issues: [] });
  });

  it('rejects anything else', () => {
    expect(codes(validateField(field('checkbox'), 'maybe', ctx))).toEqual(['error:checkbox-unknown']);
  });
});

describe('signature (Req 4.2, 4.3)', () => {
  it('is present only with the marker the mapper passes for a drawn or uploaded image', () => {
    expect(validateField(field('signature'), SIGNATURE_PRESENT, ctx)).toEqual({ ok: true, value: SIGNATURE_PRESENT, issues: [] });
  });

  it('flags a missing required signature, and never treats typed text as a signature', () => {
    for (const raw of ['', 'Asha Verma', 'signature']) {
      expect(codes(validateField(field('signature'), raw, ctx))).toEqual(['error:signature-missing']);
    }
  });

  it('is "no answer" when not required and missing', () => {
    expect(validateField(field('signature', { required: false }), '', ctx)).toEqual({ ok: true, value: '', issues: [] });
  });
});

describe('photo (field-mapping Req 5.5)', () => {
  it('is never filled and always tells the user to paste a photo after printing', () => {
    for (const required of [true, false]) {
      for (const raw of ['', 'my photo']) {
        expect(validateField(field('photo', { required }), raw, ctx)).toEqual({
          ok: true,
          value: '',
          issues: [{ fieldId: 'demo-photo', code: 'photo-paste-after-print', severity: 'info' }],
        });
      }
    }
  });
});

describe('issues never carry the value (Req 5.1)', () => {
  it('keeps the answer out of every issue', () => {
    const secret = 'Zorblax 9137';
    for (const type of ['text', 'number', 'date', 'choice', 'checkbox', 'signature', 'photo'] as const) {
      const r = validateField(field(type, { choices: ['Band A (demo)'] }), secret, ctx);
      expect(JSON.stringify(r.issues)).not.toContain('Zorblax');
    }
  });
});
