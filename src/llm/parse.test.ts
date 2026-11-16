// Tests for parseSuggestions and parseReply (llm-adapter Req 5.5): the first JSON object of a
// reply is read with hand-written guards, anything that is not the expected shape counts as no
// suggestions, and the caps hold. Field IDs, values and notes are SAMPLE / DEMO DATA.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { anyStringArb } from '../validation/arbitraries';
import { MAX_SUGGESTIONS, MAX_SUGGESTION_LENGTH, parseReply, parseSuggestions } from './parse';

const reply = (o: unknown): string => JSON.stringify(o);

const contract = reply({
  suggestions: [
    { fieldId: 'full-name', value: 'Demo Applicant' },
    { fieldId: 'dob', value: '14/08/2005' },
  ],
  warnings: [{ fieldId: 'signature', note: 'The form needs a signature (demo).' }],
});

const expected = [
  { fieldId: 'full-name', value: 'Demo Applicant' },
  { fieldId: 'dob', value: '14/08/2005' },
  { fieldId: 'signature', note: 'The form needs a signature (demo).' },
];

describe('parseSuggestions: the expected JSON (Req 5.5)', () => {
  it('reads suggestions, then warnings, in reply order', () => {
    expect(parseSuggestions(contract)).toEqual(expected);
    expect(parseReply(contract)).toEqual(expected);
  });

  it('finds the object inside prose or a code fence', () => {
    expect(parseSuggestions('Here is the JSON you asked for:\n```json\n' + contract + '\n```\nAnything else?')).toEqual(expected);
    expect(parseSuggestions(`  ${contract}  `)).toEqual(expected);
  });

  it('skips braces and escaped quotes inside strings', () => {
    const text = reply({ suggestions: [{ fieldId: 'address', value: '12 "Lantern" Lane } { (demo)' }] });
    expect(parseSuggestions(`${text} {"suggestions": []}`)).toEqual([{ fieldId: 'address', value: '12 "Lantern" Lane } { (demo)' }]);
    expect(parseSuggestions(reply({ suggestions: [{ fieldId: 'city', value: 'back\\slash\\' }] }))).toEqual([{ fieldId: 'city', value: 'back\\slash\\' }]);
  });

  it('accepts a reply with only one of the two lists', () => {
    expect(parseSuggestions(reply({ suggestions: [{ fieldId: 'dob', value: '14/08/2005' }] }))).toEqual([{ fieldId: 'dob', value: '14/08/2005' }]);
    expect(parseSuggestions(reply({ warnings: [{ fieldId: 'dob', note: 'Check the year (demo).' }] }))).toEqual([{ fieldId: 'dob', note: 'Check the year (demo).' }]);
  });

  it('tells a valid reply with nothing in it apart from bad output', () => {
    expect(parseReply(reply({ suggestions: [], warnings: [] }))).toEqual([]);
    expect(parseReply('no JSON here')).toBeNull();
    expect(parseSuggestions('no JSON here')).toEqual([]);
  });

  it('ignores other keys and builds new objects with only the contract keys', () => {
    const text = reply({
      model: 'demo-model',
      suggestions: [{ fieldId: 'city', value: 'Demo Town', confidence: 0.9, note: 'not read from a suggestion' }],
      warnings: [{ fieldId: 'city', note: 'Spelling looks unusual (demo).', value: 'not read from a warning' }],
    });
    const out = parseSuggestions(text);
    expect(out).toEqual([
      { fieldId: 'city', value: 'Demo Town' },
      { fieldId: 'city', note: 'Spelling looks unusual (demo).' },
    ]);
    expect(out.map((s) => Object.keys(s).sort())).toEqual([['fieldId', 'value'], ['fieldId', 'note']]);
  });

  it('keeps Hindi text and blank strings as they are (the merge step normalises and validates)', () => {
    const text = reply({ suggestions: [{ fieldId: 'city', value: 'नमूना नगर' }, { fieldId: 'dob', value: ' ' }], warnings: [{ fieldId: '', note: '' }] });
    expect(parseSuggestions(text)).toEqual([
      { fieldId: 'city', value: 'नमूना नगर' },
      { fieldId: 'dob', value: ' ' },
      { fieldId: '', note: '' },
    ]);
  });
});

describe('parseSuggestions: anything else is no suggestions (Req 5.5)', () => {
  it.each([
    ['empty text', ''],
    ['whitespace', ' \n\t'],
    ['prose', 'I could not find any values.'],
    ['a top-level array', reply([{ fieldId: 'dob', value: '14/08/2005' }])],
    ['an object with neither list', reply({ fields: [] })],
    ['an empty object', '{}'],
    ['a reply cut off halfway', contract.slice(0, contract.length - 3)],
    ['an unclosed brace', '{"suggestions": [{"fieldId": "dob", "value": "14/08/2005"}]'],
    ['invalid JSON in braces', '{suggestions: [{fieldId: dob}]}'],
    ['a list that is not an array', reply({ suggestions: { fieldId: 'dob', value: '14/08/2005' } })],
    ['null for a list', reply({ suggestions: null, warnings: [] })],
    ['an item that is a string', reply({ suggestions: ['dob=14/08/2005'] })],
    ['an item that is an array', reply({ suggestions: [['dob', '14/08/2005']] })],
    ['a number value', reply({ suggestions: [{ fieldId: 'phone', value: 9876543210 }] })],
    ['a null value', reply({ suggestions: [{ fieldId: 'dob', value: null }] })],
    ['a missing value', reply({ suggestions: [{ fieldId: 'dob' }] })],
    ['a missing field ID', reply({ suggestions: [{ value: '14/08/2005' }] })],
    ['a number field ID', reply({ suggestions: [{ fieldId: 7, value: 'x' }] })],
    ['a warning with no note', reply({ warnings: [{ fieldId: 'dob' }] })],
    ['a bad warning next to good suggestions', reply({ suggestions: [{ fieldId: 'dob', value: '14/08/2005' }], warnings: [{ fieldId: 'dob', note: 3 }] })],
    ['a first object that is not the reply', 'Fields {full-name, dob}: ' + contract],
  ])('%s', (_name, text) => {
    expect(parseSuggestions(text)).toEqual([]);
    expect(parseReply(text)).toBeNull();
  });

  it('reads own properties only, so "__proto__" in the JSON cannot supply a field ID or value', () => {
    const text = '{"suggestions": [{"__proto__": {"fieldId": "dob", "value": "14/08/2005"}}]}';
    expect(parseSuggestions(text)).toEqual([]);
    const top = '{"__proto__": {"suggestions": [{"fieldId": "dob", "value": "14/08/2005"}]}}';
    expect(parseSuggestions(top)).toEqual([]);
    expect(({} as Record<string, unknown>).suggestions).toBeUndefined();
  });

  it('does not throw on deep nesting or input that is not a string', () => {
    const deep = `{"suggestions": ${'['.repeat(100_000)}${']'.repeat(100_000)}}`;
    expect(parseSuggestions(deep)).toEqual([]);
    for (const x of [undefined, null, 42, {}, ['{}']]) expect(parseSuggestions(x as unknown as string)).toEqual([]);
  });
});

describe('parseSuggestions: caps (Req 5.5)', () => {
  const values = (n: number, length = 5): { fieldId: string; value: string }[] =>
    Array.from({ length: n }, (_, i) => ({ fieldId: `field-${i}`, value: 'v'.repeat(length) }));

  it(`keeps the first ${MAX_SUGGESTIONS} items, suggestions before warnings`, () => {
    expect(parseSuggestions(reply({ suggestions: values(150) }))).toEqual(values(MAX_SUGGESTIONS));
    const notes = [1, 2, 3].map((i) => ({ fieldId: `field-${i}`, note: `Demo note ${i}.` }));
    const out = parseSuggestions(reply({ suggestions: values(99), warnings: notes }));
    expect(out).toHaveLength(MAX_SUGGESTIONS);
    expect(out[99]).toEqual({ fieldId: 'field-1', note: 'Demo note 1.' });
  });

  it(`drops a value or note over ${MAX_SUGGESTION_LENGTH} characters instead of cutting it, and keeps the rest`, () => {
    const atLimit = 'a'.repeat(MAX_SUGGESTION_LENGTH);
    const over = 'a'.repeat(MAX_SUGGESTION_LENGTH + 1);
    const text = reply({
      suggestions: [
        { fieldId: 'statement', value: over },
        { fieldId: 'address', value: atLimit },
      ],
      warnings: [
        { fieldId: 'statement', note: over },
        { fieldId: 'address', note: atLimit },
      ],
    });
    expect(parseSuggestions(text)).toEqual([
      { fieldId: 'address', value: atLimit },
      { fieldId: 'address', note: atLimit },
    ]);
  });

  it('counts the cap after dropping over-long items', () => {
    const text = reply({ suggestions: [{ fieldId: 'long', value: 'x'.repeat(MAX_SUGGESTION_LENGTH + 1) }, ...values(MAX_SUGGESTIONS)] });
    expect(parseSuggestions(text)).toEqual(values(MAX_SUGGESTIONS));
  });
});

describe('parseSuggestions is total (Req 5.5)', () => {
  const fieldIdArb = fc.oneof(fc.constantFrom('full-name', 'dob', 'city'), fc.string({ maxLength: 12 }));
  const itemTextArb = fc.oneof(fc.string({ unit: 'binary', maxLength: 40 }), fc.string({ minLength: 190, maxLength: 260 }));
  // Replies of the contract shape, built from fc.record objects; either list may be missing.
  const contractArb = fc.record(
    {
      suggestions: fc.array(fc.record({ fieldId: fieldIdArb, value: itemTextArb }), { maxLength: 6 }),
      warnings: fc.array(fc.record({ fieldId: fieldIdArb, note: itemTextArb }), { maxLength: 3 }),
    },
    { requiredKeys: [] },
  );
  const wellFormedArb = contractArb.map(reply);
  const textArb = fc.oneof(
    anyStringArb(),
    fc.json(),
    fc.jsonValue().map((v) => reply({ suggestions: v })),
    fc.array(fc.jsonValue(), { maxLength: 5 }).map((list) => reply({ suggestions: list, warnings: list })),
    wellFormedArb,
    wellFormedArb.map((t) => `Sure, here you go:\n\`\`\`json\n${t}\n\`\`\``),
    // Cut off anywhere, as a reply that hit max_tokens would be.
    fc.tuple(wellFormedArb, fc.nat()).map(([t, cut]) => t.slice(0, cut % (t.length + 1))),
  );

  it('for any text returns a capped list of items with a string field ID and exactly one string value or note', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        const out = parseSuggestions(text);
        expect(Array.isArray(out)).toBe(true);
        expect(out.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
        for (const s of out) {
          expect(typeof s.fieldId).toBe('string');
          const keys = Object.keys(s).sort();
          expect(keys.length === 2 && (keys[1] === 'note' || keys[1] === 'value')).toBe(true);
          const text2 = s.value ?? s.note ?? '';
          expect(typeof text2).toBe('string');
          expect(text2.length).toBeLessThanOrEqual(MAX_SUGGESTION_LENGTH);
        }
        expect(parseReply(text) ?? []).toEqual(out);
      }),
    );
  });

  it('reads any reply of the contract shape exactly: suggestions, then warnings, over-long items dropped', () => {
    fc.assert(
      fc.property(contractArb, (o) => {
        const fits = (s: string): boolean => s.length <= MAX_SUGGESTION_LENGTH;
        const items = [
          ...(o.suggestions ?? []).filter((s) => fits(s.value)).map((s) => ({ fieldId: s.fieldId, value: s.value })),
          ...(o.warnings ?? []).filter((w) => fits(w.note)).map((w) => ({ fieldId: w.fieldId, note: w.note })),
        ];
        expect(parseSuggestions(reply(o))).toEqual(items);
      }),
    );
  });

  it('generates replies that do give items, so the property is not vacuous', () => {
    const samples = fc.sample(textArb, { numRuns: 500, seed: 5 });
    const read = samples.filter((t) => parseSuggestions(t).length > 0).length;
    expect(read).toBeGreaterThan(0);
    expect(read).toBeLessThan(samples.length);
  });
});
