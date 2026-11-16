// Property P3 (stitch-code Req 5.1, 5.2, 2.3, 3.4; design.md "Correctness properties").
// For any form ID, any answers (field ID and grapheme-string pairs) and any passphrase p:
// - sealing then opening with p returns exactly the form ID and answers, or sealing says
//   "too-large" exactly when the JSON plaintext is over 64 KiB (Req 3.4);
// - any q whose normalised form (NFC, trimmed) differs from p's gives "cannot-open" and no data
//   (passphrases are generated as well-formed Unicode, as people type them);
// - flipping any bits of any one byte of a stitch code makes opening fail with no data.
// Test-only shortcut (design.md): the property calls the internal sealWithIterations and
// openWithBounds with 1,000 PBKDF2 iterations, passed explicitly, so 100 cases run in about a
// second. The production count, 600,000, is checked by an example in stitch-code.test.ts.
// All generated values are random demo data.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_INFLATED_BYTES } from './compress';
import { normalisePassphrase } from './crypto';
import { HEADER_BYTES, type Bytes } from './format';
import { toPayload, type StitchAnswer, type StitchPayload } from './payload';
import { openWithBounds, sealWithIterations } from './stitch-code';

const TEST_ITERATIONS = 1_000;
const TEST_BOUNDS = { min: TEST_ITERATIONS, max: TEST_ITERATIONS };
/** Each case derives keys, so runs with a high FC_NUM_RUNS need more than Vitest's 5 s default. */
const SLOW = 120_000;

const graphemes = (maxLength: number): fc.Arbitrary<string> => fc.string({ unit: 'grapheme', maxLength });

/** Field IDs as forms use them, plus any text (an old or edited form may have others). */
const fieldIdArb = fc.oneof(
  { weight: 3, arbitrary: fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,11}$/) },
  { weight: 1, arbitrary: graphemes(12) },
);

/** Mostly short answers; now and then one long enough to push the payload past 64 KiB. */
const answerTextArb = fc.oneof(
  { weight: 19, arbitrary: graphemes(30) },
  {
    weight: 1,
    arbitrary: fc
      .tuple(fc.string({ unit: 'grapheme', minLength: 1, maxLength: 3 }), fc.integer({ min: 1_000, max: 30_000 }))
      .map(([s, n]) => s.repeat(n)),
  },
);

const payloadArb: fc.Arbitrary<StitchPayload> = fc.record({
  formId: fc.oneof(fc.constantFrom('sample-lantern-hill-admission', 'sample-hollowbrook-hostel'), graphemes(30)),
  answers: fc.array(fc.tuple(fieldIdArb, answerTextArb).map((a): StitchAnswer => a), { maxLength: 8 }),
});

/** Any text that still holds something after normalisation, or five generated-style words. */
const passphraseArb = fc
  .oneof(
    graphemes(40),
    fc.array(fc.stringMatching(/^[a-z]{3,9}$/), { minLength: 5, maxLength: 5 }).map((w) => w.join(' ')),
  )
  .filter((p) => normalisePassphrase(p) !== '');

/** A near miss of p (a character added, a code point dropped, upper case) or any other passphrase. Well-formed like p. */
function otherPassphraseArb(p: string): fc.Arbitrary<string> {
  const codePoints = [...p];
  return fc.oneof(
    graphemes(1).map((c) => p + c),
    fc.nat().map((i) => {
      const at = i % codePoints.length;
      return [...codePoints.slice(0, at), ...codePoints.slice(at + 1)].join('');
    }),
    fc.constant(p.toUpperCase()),
    passphraseArb,
  );
}

/** Which part of the code to change: the checked header fields (bytes 0 to 7), salt and IV, or the sealed bytes. */
const regionArb = fc.constantFrom('header-checked' as const, 'salt-iv' as const, 'sealed' as const);

function byteIndex(region: 'header-checked' | 'salt-iv' | 'sealed', n: number, length: number): number {
  if (region === 'header-checked') return n % 8;
  if (region === 'salt-iv') return 8 + (n % (HEADER_BYTES - 8));
  return HEADER_BYTES + (n % (length - HEADER_BYTES));
}

const isTooLarge = (x: StitchPayload): boolean => toPayload(x.formId, x.answers).length > MAX_INFLATED_BYTES;

async function sealOrSkip(x: StitchPayload, p: string): Promise<Bytes | null> {
  const created = await sealWithIterations(x, p, TEST_ITERATIONS);
  expect(created.ok).toBe(!isTooLarge(x));
  if (!created.ok) {
    expect(created).toEqual({ ok: false, code: 'too-large' });
    return null;
  }
  return created.bytes;
}

describe('P3: stitch-code round-trip', () => {
  it('opening with the same passphrase returns exactly the form ID and answers (Req 5.1, 3.4)', { timeout: SLOW }, async () => {
    await fc.assert(
      fc.asyncProperty(payloadArb, passphraseArb, async (x, p) => {
        const bytes = await sealOrSkip(x, p);
        if (bytes === null) return;
        expect(await openWithBounds(bytes, p, TEST_BOUNDS)).toEqual({ ok: true, payload: x });
      }),
    );
  });

  it('a passphrase that normalises differently never opens it (Req 5.2)', { timeout: SLOW }, async () => {
    const input = fc
      .tuple(payloadArb, passphraseArb)
      .chain(([x, p]) => fc.tuple(fc.constant(x), fc.constant(p), otherPassphraseArb(p)))
      .filter(([, p, q]) => normalisePassphrase(q) !== normalisePassphrase(p));
    await fc.assert(
      fc.asyncProperty(input, async ([x, p, q]) => {
        const bytes = await sealOrSkip(x, p);
        if (bytes === null) return;
        expect(await openWithBounds(bytes, q, TEST_BOUNDS)).toEqual({ ok: false, code: 'cannot-open' });
      }),
    );
  });

  it('changing any one byte makes opening fail with no data (Req 2.3, 5.2)', { timeout: SLOW }, async () => {
    const change = fc.tuple(regionArb, fc.nat(), fc.integer({ min: 1, max: 255 }));
    await fc.assert(
      fc.asyncProperty(payloadArb, passphraseArb, change, async (x, p, [region, n, mask]) => {
        const bytes = await sealOrSkip(x, p);
        if (bytes === null) return;
        const at = byteIndex(region, n, bytes.length);
        const changed = new Uint8Array(bytes);
        changed[at] = (changed[at] ?? 0) ^ mask;
        // Magic, version, KDF ID and count fail the header check (with these bounds any other
        // count is out of range). Salt, IV, ciphertext and tag fail decryption.
        const expected = region === 'header-checked' ? 'not-stitch-code' : 'cannot-open';
        expect(await openWithBounds(changed, p, TEST_BOUNDS)).toEqual({ ok: false, code: expected });
      }),
    );
  });

  it('generates both sides of the 64 KiB limit and text beyond ASCII, so P3 is not vacuous', () => {
    const samples = fc.sample(payloadArb, { numRuns: 300, seed: 3 });
    const tooLarge = samples.filter(isTooLarge).length;
    expect(tooLarge).toBeGreaterThan(0);
    expect(tooLarge).toBeLessThan(samples.length / 2);
    const texts = samples.flatMap((x) => x.answers.map(([, t]) => t));
    expect(texts.some((t) => /[^\u0000-\u007f]/u.test(t))).toBe(true);
    // Code points outside the Basic Multilingual Plane take two UTF-16 units.
    expect(texts.some((t) => [...t].some((c) => c.length === 2))).toBe(true);
    expect(samples.some((x) => x.answers.length === 0)).toBe(true);
  });
});
