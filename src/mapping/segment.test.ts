import { describe, expect, it } from 'vitest';
import type { FormField } from '../form-model';
import { buildLabelIndex, segment } from './segment';

// Fictional demo fields and demo people only (SAMPLE / DEMO DATA).
function field(id: string, label: string, type: FormField['type'] = 'text'): FormField {
  return { id, label, type, required: true, bbox: { x: 0, y: 0, w: 0.5, h: 0.05 }, page: 0 };
}

const hostel = [
  field('full-name', 'Full name'),
  field('dob', 'Date of birth', 'date'),
  field('address', 'Address'),
  field('emergency-contact-name', 'Emergency contact name'),
  field('emergency-contact-phone', 'Emergency contact phone', 'number'),
  field('signature', 'Signature', 'signature'),
];
const index = buildLabelIndex(hostel);

describe('buildLabelIndex', () => {
  it('lists each field label as exact and its synonyms as not exact', () => {
    expect(index).toContainEqual({ label: 'full name', fieldId: 'full-name', exact: true });
    expect(index).toContainEqual({ label: 'name', fieldId: 'full-name', exact: false });
    expect(index).toContainEqual({ label: 'जन्म तिथि', fieldId: 'dob', exact: false });
    expect(index.filter((e) => e.fieldId === 'dob' && e.label === 'date of birth')).toHaveLength(1);
  });

  it('indexes a label with no synonyms on its own, and skips blank labels', () => {
    const idx = buildLabelIndex([field('blood-group', 'Blood group:'), field('blank', ' * ')]);
    expect(idx).toEqual([{ label: 'blood group', fieldId: 'blood-group', exact: true }]);
  });
});

describe('segment (Req 4.1, 4.3)', () => {
  it('splits an English sentence into fields and keeps the value as written', () => {
    const r = segment('My name is Asha Verma, date of birth 5 March 2004.', index);
    expect(r.segments).toEqual([
      { fieldId: 'full-name', label: 'my name', value: 'Asha Verma' },
      { fieldId: 'dob', label: 'date of birth', value: '5 March 2004' },
    ]);
    expect(r.unmatched).toEqual([]);
  });

  it('splits a Hindi sentence and strips Hindi connectors', () => {
    const r = segment('मेरा नाम आशा वर्मा है और मेरी जन्म तिथि 5 मार्च 2004 है।', index);
    expect(r.segments).toEqual([
      { fieldId: 'full-name', label: 'मेरा नाम', value: 'आशा वर्मा' },
      { fieldId: 'dob', label: 'जन्म तिथि', value: '5 मार्च 2004' },
    ]);
  });

  it('handles labels with colons and keeps case', () => {
    const r = segment('NAME: Asha VERMA; Address: 12 Lantern Lane, Demo Town', index);
    expect(r.segments).toEqual([
      { fieldId: 'full-name', label: 'name', value: 'Asha VERMA' },
      { fieldId: 'address', label: 'address', value: '12 Lantern Lane, Demo Town' },
    ]);
  });

  it('prefers the longest label at a position', () => {
    const r = segment('emergency contact phone 98765 43210 emergency contact name Ravi Demo', index);
    expect(r.segments.map((s) => [s.fieldId, s.value])).toEqual([
      ['emergency-contact-phone', '98765 43210'],
      ['emergency-contact-name', 'Ravi Demo'],
    ]);
  });

  it('does not find a label inside a longer word, in either script', () => {
    expect(segment('surname Verma', index)).toEqual({ segments: [], unmatched: ['surname Verma'] });
    expect(segment('नामांकन 5', index)).toEqual({ segments: [], unmatched: ['नामांकन 5'] });
  });

  it('sends text before the first label, and text with no label, to unmatched', () => {
    expect(segment('hello there, name Asha', index)).toEqual({
      segments: [{ fieldId: 'full-name', label: 'name', value: 'Asha' }],
      unmatched: ['hello there'],
    });
    expect(segment('just some words', index)).toEqual({ segments: [], unmatched: ['just some words'] });
  });

  it('drops a label with no value and returns nothing for blank text', () => {
    expect(segment('name', index)).toEqual({ segments: [], unmatched: [] });
    expect(segment('  is  ', index)).toEqual({ segments: [], unmatched: [] });
    expect(segment('', index)).toEqual({ segments: [], unmatched: [] });
  });

  it('sends a label shared equally by two fields to unmatched (Req 4.3)', () => {
    const twoDates = buildLabelIndex([field('arrival', 'Date', 'date'), field('departure', 'Date', 'date')]);
    expect(segment('date 5 March 2026', twoDates)).toEqual({ segments: [], unmatched: ['date 5 March 2026'] });
  });

  it('lets an exact label beat a synonym of another field', () => {
    const idx = buildLabelIndex([field('nickname', 'Name'), field('full-name', 'Full name')]);
    expect(segment('name Ashu', idx).segments).toEqual([{ fieldId: 'nickname', label: 'name', value: 'Ashu' }]);
  });

  it('sends a synonym shared by two fields to unmatched', () => {
    const idx = buildLabelIndex([field('a', 'Full name'), field('b', 'Applicant name')]);
    expect(segment('name Asha', idx)).toEqual({ segments: [], unmatched: ['name Asha'] });
  });

  it('keeps Devanagari digits and every later occurrence of a field', () => {
    const r = segment('name Asha name Asha Verma, जन्म तिथि ५/३/२००४', index);
    expect(r.segments).toEqual([
      { fieldId: 'full-name', label: 'name', value: 'Asha' },
      { fieldId: 'full-name', label: 'name', value: 'Asha Verma' },
      { fieldId: 'dob', label: 'जन्म तिथि', value: '५/३/२००४' },
    ]);
  });
});
