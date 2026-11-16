// Example tests for creating and opening stitch codes. The first block uses the production
// count (600,000 PBKDF2 iterations) through the public API. The rest call the internal
// sealWithIterations / openWithBounds with 1,000 iterations, passed explicitly, to stay fast.
// The form, answers and passphrases are SAMPLE / DEMO DATA.

import { deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Answer, FormField, FormModel } from '../form-model';
import { mapAnswers } from '../mapping';
import type { ValidationContext } from '../validation';
import { deflateRaw } from './compress';
import { deriveKey, randomBytes, seal } from './crypto';
import { DEFAULT_ITERATIONS, HEADER_BYTES, IV_BYTES, SALT_BYTES, decodeHeader, encodeHeader, joinStitchCode, type Bytes } from './format';
import * as publicApi from './index';
import { payloadFromResult, type StitchPayload } from './payload';
import { createStitchCode, openStitchCode, openWithBounds, refillForm, sealWithIterations } from './stitch-code';

const ctx: ValidationContext = { today: { y: 2026, m: 11, d: 16 }, lang: 'en' };
const PASSPHRASE = 'demo lantern stitch hollow brook';
const TEST_ITERATIONS = 1_000;
const TEST_BOUNDS = { min: TEST_ITERATIONS, max: TEST_ITERATIONS };

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
    field('city', 'City', 'text'),
    field('dob', 'Date of birth', 'date', { dateRole: 'dob' }),
    field('room-type', 'Room type', 'choice', { choices: ['Shared (demo)', 'Single (demo)'] }),
    field('photo', 'Photo', 'photo'),
    field('signature', 'Signature', 'signature'),
  ],
};

const prompt = (promptedFieldId: string, text: string, seq: number): Answer => ({ text, source: 'typed', lang: 'en', promptedFieldId, seq });
const answers = [
  prompt('full-name', 'Demo Applicant', 0),
  prompt('city', 'नमूना नगर', 1),
  prompt('dob', '31/02/2005', 2),
  prompt('room-type', 'single', 3),
];
const signatures = new Set(['signature']);
const first = mapAnswers(form, answers, signatures, ctx);
const payload: StitchPayload = payloadFromResult(first);

/** A correctly encrypted stitch code around any plaintext, for testing the checks after decryption. */
async function sealPlaintext(plaintext: Bytes): Promise<Bytes> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const header = encodeHeader(TEST_ITERATIONS, salt, iv);
  return joinStitchCode(header, await seal(await deriveKey(PASSPHRASE, salt, TEST_ITERATIONS), iv, header, plaintext));
}

async function sealTest(p: StitchPayload = payload, passphrase = PASSPHRASE): Promise<Bytes> {
  const created = await sealWithIterations(p, passphrase, TEST_ITERATIONS);
  if (!created.ok) throw new Error(created.code);
  return created.bytes;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public API with the production iteration count (Req 2.1, 5.1)', () => {
  it('writes 600,000 into the header, opens with the passphrase and refills the same fields', { timeout: 30_000 }, async () => {
    expect(first.fields['full-name']?.status).toBe('filled');
    expect(first.fields.dob?.status).toBe('flagged');

    const created = await createStitchCode(first, PASSPHRASE);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    // 600,000 = 0x000927C0, big-endian at offset 4.
    expect([...created.bytes.slice(4, 8)]).toEqual([0x00, 0x09, 0x27, 0xc0]);
    const header = decodeHeader(created.bytes);
    expect(header.ok && header.header.iterations).toBe(600_000);
    expect(DEFAULT_ITERATIONS).toBe(600_000);

    const opened = await openStitchCode(created.bytes, PASSPHRASE);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.formId).toBe(form.id);
    expect(opened.answers.map((a) => [a.promptedFieldId, a.text])).toEqual(payload.answers);
    expect(opened.answers.every((a) => a.source === 'stitch-code')).toBe(true);

    const refilled = refillForm(form, opened, signatures, ctx);
    expect(refilled.status).toBe('refilled');
    if (refilled.status !== 'refilled') return;
    for (const f of form.fields) {
      const a = first.fields[f.id];
      const b = refilled.result.fields[f.id];
      expect([b?.status, b?.value, b?.raw]).toEqual([a?.status, a?.value, a?.raw]);
      expect(b?.provenance).toBe(a?.provenance === undefined ? undefined : 'stitch-code');
    }

    expect(await openStitchCode(created.bytes, `${PASSPHRASE} again`)).toEqual({ ok: false, code: 'cannot-open' });
  });

  it('exposes only the production entry points', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'COMMON_PASSWORDS_PATH',
      'DEFAULT_ITERATIONS',
      'MIN_PASSPHRASE_LENGTH',
      'WORD_LIST_PATH',
      'checkCustomPassphrase',
      'createStitchCode',
      'generatePassphrase',
      'openStitchCode',
      'parseCommonPasswords',
      'parseWordList',
      'passphraseLength',
      'passphraseMessage',
      'refillForm',
    ]);
  });
});

describe('creating (Req 2.1, 2.2, 3.1 to 3.4)', () => {
  it('uses a fresh salt and IV every time, so the same answers never give the same bytes', async () => {
    const a = await sealTest();
    const b = await sealTest();
    expect([...a.slice(8, 24)]).not.toEqual([...b.slice(8, 24)]);
    expect([...a.slice(24, HEADER_BYTES)]).not.toEqual([...b.slice(24, HEADER_BYTES)]);
    expect([...a.slice(HEADER_BYTES)]).not.toEqual([...b.slice(HEADER_BYTES)]);
  });

  it('holds no answer, field ID or passphrase in readable form', async () => {
    const text = new TextDecoder('latin1').decode(await sealTest());
    for (const s of ['Demo Applicant', 'full-name', 'sample-hollowbrook-hostel', 'demo lantern', '"v":1']) expect(text).not.toContain(s);
  });

  it('puts only the form ID and per-field text inside, never the signature or photo (Req 3.1, 3.2)', async () => {
    const opened = await openWithBounds(await sealTest(), PASSPHRASE, TEST_BOUNDS);
    expect(opened).toEqual({
      ok: true,
      payload: {
        formId: 'sample-hollowbrook-hostel',
        answers: [
          ['full-name', 'Demo Applicant'],
          ['city', 'नमूना नगर'],
          ['dob', '31/02/2005'],
          ['room-type', 'Single (demo)'],
        ],
      },
    });
  });

  it('refuses answers over 64 KiB with too-large before deriving a key (Req 3.4)', async () => {
    const derive = vi.spyOn(crypto.subtle, 'deriveKey');
    const big: StitchPayload = { formId: form.id, answers: [['full-name', 'a'.repeat(70_000)]] };
    expect(await sealWithIterations(big, PASSPHRASE, TEST_ITERATIONS)).toEqual({ ok: false, code: 'too-large' });
    const bigResult = { ...first, fields: { ...first.fields, 'full-name': { fieldId: 'full-name', status: 'filled' as const, value: 'a'.repeat(70_000), provenance: 'typed' as const, issues: [] } } };
    expect(await createStitchCode(bigResult, PASSPHRASE)).toEqual({ ok: false, code: 'too-large' });
    expect(derive).not.toHaveBeenCalled();
  });

  it('refuses an empty passphrase as a programming error', async () => {
    await expect(createStitchCode(first, '')).rejects.toThrow(RangeError);
    await expect(sealWithIterations(payload, ' \n ', TEST_ITERATIONS)).rejects.toThrow(RangeError);
  });
});

describe('opening (Req 2.4, 5.2, 5.4)', () => {
  it('opens with the same passphrase typed with extra spaces or decomposed accents', async () => {
    const accented = 'demo caf\u00e9 lantern brook stitch';
    const bytes = await sealTest(payload, accented);
    const opened = await openWithBounds(bytes, ' demo cafe\u0301 lantern brook stitch ', TEST_BOUNDS);
    expect(opened.ok).toBe(true);
  });

  it('gives cannot-open and nothing else for a wrong passphrase', async () => {
    expect(await openWithBounds(await sealTest(), 'demo lantern stitch hollow brooK', TEST_BOUNDS)).toEqual({ ok: false, code: 'cannot-open' });
  });

  it.each([
    ['plaintext that is not deflate data', async () => Uint8Array.of(0xff, 0xff, 0xff)],
    ['deflate of text that is not JSON', async () => compressed('not json')],
    ['deflate of JSON with another version', async () => compressed('{"v":2,"f":"sample-demo","a":[]}')],
    ['deflate of JSON with an extra key', async () => compressed('{"v":1,"f":"sample-demo","a":[],"k":"x"}')],
    ['deflate that inflates past 64 KiB', async () => new Uint8Array(deflateRawSync(new Uint8Array(64 * 1024 + 1)))],
  ])('gives cannot-open for a correctly encrypted %s (Req 3.4, 5.2)', async (_name, plaintext) => {
    const bytes = await sealPlaintext(await plaintext());
    expect(await openWithBounds(bytes, PASSPHRASE, TEST_BOUNDS)).toEqual({ ok: false, code: 'cannot-open' });
  });

  it('accepts a correctly encrypted, well-formed plaintext built the same way, so the cases above fail for their content', async () => {
    const bytes = await sealPlaintext(await compressed('{"v":1,"f":"sample-demo","a":[["full-name","Demo"]]}'));
    expect(await openWithBounds(bytes, PASSPHRASE, TEST_BOUNDS)).toEqual({ ok: true, payload: { formId: 'sample-demo', answers: [['full-name', 'Demo']] } });
  });

  it('says not-stitch-code for other bytes and for a count below 600,000, without deriving a key (Req 2.4, 5.4)', async () => {
    const lowCount = await sealTest();
    const derive = vi.spyOn(crypto.subtle, 'deriveKey');
    expect(await openStitchCode(lowCount, PASSPHRASE)).toEqual({ ok: false, code: 'not-stitch-code' });
    expect(await openStitchCode(new TextEncoder().encode('https://example.com/demo'.repeat(4)), PASSPHRASE)).toEqual({ ok: false, code: 'not-stitch-code' });
    const otherVersion = new Uint8Array(lowCount);
    otherVersion[2] = 2;
    expect(await openWithBounds(otherVersion, PASSPHRASE, TEST_BOUNDS)).toEqual({ ok: false, code: 'not-stitch-code' });
    expect(derive).not.toHaveBeenCalled();
    // The spy does see derivations: opening with bounds that allow the count derives once.
    expect(await openWithBounds(lowCount, PASSPHRASE, TEST_BOUNDS)).toMatchObject({ ok: true });
    expect(derive).toHaveBeenCalledTimes(1);
  });
});

describe('refillForm (Req 5.1, 5.3)', () => {
  const opened = { formId: 'sample-lantern-hill-admission', answers: [prompt('full-name', 'Demo Applicant', 0), prompt('stream', 'Science', 1)] };

  it('asks first when the stitch code belongs to another form', () => {
    expect(refillForm(form, opened, signatures, ctx)).toEqual({ status: 'other-form', formId: 'sample-lantern-hill-admission' });
  });

  it('maps anyway once the user confirms, and keeps answers for missing fields in unmatched', () => {
    const r = refillForm(form, opened, signatures, ctx, true);
    expect(r.status).toBe('refilled');
    if (r.status !== 'refilled') return;
    expect(r.result.formId).toBe(form.id);
    expect(r.result.fields['full-name']?.value).toBe('Demo Applicant');
    expect(r.result.unmatched).toEqual(['Science']);
  });
});

async function compressed(text: string): Promise<Bytes> {
  const r = await deflateRaw(new TextEncoder().encode(text));
  if (!r.ok) throw new Error(r.code);
  return r.bytes;
}
