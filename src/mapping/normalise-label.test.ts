import { describe, expect, it } from 'vitest';
import en from './synonyms.en.json';
import hi from './synonyms.hi.json';
import { SAMPLE_LABELS } from './__fixtures__/sample-labels';
import { foldForSearch, normaliseLabel } from './normalise-label';
import { allSynonyms, canonicalKeyFor, synonymsFor } from './synonyms';

describe('normaliseLabel (Req 4.2)', () => {
  it.each([
    ['Date of Birth:', 'date of birth'],
    ['  Full   NAME *', 'full name'],
    ['Name *:', 'name'],
    ['D.O.B.', 'd.o.b'],
    ['Address\t\n', 'address'],
    ['जन्म तिथि:', 'जन्म तिथि'],
    ['पता।', 'पता'],
    ['', ''],
    [' :* ', ''],
  ])('%j becomes %j', (input, expected) => {
    expect(normaliseLabel(input)).toBe(expected);
  });

  it('applies NFC, so precomposed and decomposed forms compare equal', () => {
    // "e" + combining acute accent versus the precomposed letter.
    expect(normaliseLabel('Re\u0301sume\u0301')).toBe(normaliseLabel('R\u00e9sum\u00e9'));
    // Devanagari "pha" with nukta as one code point (U+095E) and as two (U+092B U+093C).
    expect(normaliseLabel('\u095eोटो')).toBe(normaliseLabel('\u092b\u093cोटो'));
  });

  it('keeps inner punctuation', () => {
    expect(normaliseLabel('Parent/guardian name')).toBe('parent/guardian name');
    expect(normaliseLabel('Check-in date')).toBe('check-in date');
  });
});

describe('foldForSearch', () => {
  it('maps every folded position back to the original text', () => {
    const text = 'My  NAME is\tAsha';
    const { folded, map } = foldForSearch(text);
    expect(folded).toBe('my name is asha');
    expect(map).toHaveLength(folded.length + 1);
    const at = folded.indexOf('asha');
    expect(text.slice(map[at], map[at + 4])).toBe('Asha');
  });
});

describe('synonym data (Req 4.5)', () => {
  it('uses the same canonical keys in English and Hindi', () => {
    expect(Object.keys(hi.labels).sort()).toEqual(Object.keys(en.labels).sort());
  });

  it('never lists one normalised variant under two keys', () => {
    const owner = new Map<string, string>();
    for (const file of [en, hi]) {
      for (const [key, variants] of Object.entries(file.labels)) {
        for (const v of variants) {
          const label = normaliseLabel(v);
          expect(label, `${v} is blank after normalisation`).not.toBe('');
          const previous = owner.get(label);
          expect(previous === undefined || previous === key, `"${v}" is under ${previous} and ${key}`).toBe(true);
          owner.set(label, key);
        }
      }
    }
  });

  it('covers every label on the three sample forms, in English and Hindi', () => {
    for (const s of SAMPLE_LABELS) {
      expect(canonicalKeyFor(s.en), `${s.form} ${s.en}`).toBe(s.fieldId);
      expect(canonicalKeyFor(s.hi), `${s.form} ${s.hi}`).toBe(s.fieldId);
    }
  });

  it('finds common spoken and written variants', () => {
    expect(canonicalKeyFor('DOB')).toBe('dob');
    expect(canonicalKeyFor('Birth date')).toBe('dob');
    expect(canonicalKeyFor('जन्म की तारीख')).toBe('dob');
    expect(canonicalKeyFor('फोटो')).toBe('photo');
    expect(canonicalKeyFor('Mobile number')).toBe('emergency-contact-phone');
  });

  it('returns null and no synonyms for an unknown label', () => {
    expect(canonicalKeyFor('Blood group')).toBeNull();
    expect(synonymsFor('Blood group')).toEqual([]);
    expect(canonicalKeyFor('(note)')).toBeNull();
  });

  it('returns English and Hindi variants together', () => {
    const dob = synonymsFor('Date of birth');
    expect(dob).toContain('dob');
    expect(dob).toContain('जन्म तिथि');
    expect(dob.every((v) => v === normaliseLabel(v))).toBe(true);
    expect(allSynonyms().get('dob')).toEqual(dob);
  });
});
