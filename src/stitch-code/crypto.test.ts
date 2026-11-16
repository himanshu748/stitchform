// Unit tests for crypto.ts. Every test derives with 1,000 PBKDF2 iterations to stay fast; this
// count is passed explicitly and is never a production default (stitch codes are created with
// DEFAULT_ITERATIONS, 600,000). Passphrases and answers here are demo data.

import { createCipheriv, pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AES_KEY_BITS, TAG_BITS, deriveKey, normalisePassphrase, open, randomBytes, seal } from './crypto';
import { HEADER_BYTES, IV_BYTES, SALT_BYTES, TAG_BYTES, encodeHeader, type Bytes } from './format';

const TEST_ITERATIONS = 1_000;
const passphrase = 'demo lantern stitch hollow brook';
const salt = Uint8Array.from({ length: SALT_BYTES }, (_, i) => i * 7);
const iv = Uint8Array.from({ length: IV_BYTES }, (_, i) => 0xc0 + i);
const header = encodeHeader(TEST_ITERATIONS, salt, iv);
const plaintext = new TextEncoder().encode('{"v":1,"f":"sample-demo","a":[["full-name","Demo Person"]]}');

async function sealDemo(): Promise<Bytes> {
  return seal(await deriveKey(passphrase, salt, TEST_ITERATIONS), iv, header, plaintext);
}

function flip(bytes: Uint8Array, at: number, mask = 0x01): Bytes {
  const out = new Uint8Array(bytes);
  out[at] = (out[at] ?? 0) ^ mask;
  return out;
}

describe('deriveKey (Req 2.1)', () => {
  it('derives a non-extractable 256-bit AES-GCM key that can only encrypt and decrypt', async () => {
    const key = await deriveKey(passphrase, salt, TEST_ITERATIONS);
    expect(key.type).toBe('secret');
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toEqual({ name: 'AES-GCM', length: AES_KEY_BITS });
    expect([...key.usages].sort()).toEqual(['decrypt', 'encrypt']);
  });

  it('matches PBKDF2-HMAC-SHA256 from Node crypto with the same salt and count', async () => {
    // Seal with the derived key, then open with a key built from Node's own PBKDF2 output.
    const sealed = await sealDemo();
    const raw = new Uint8Array(pbkdf2Sync(passphrase, salt, TEST_ITERATIONS, AES_KEY_BITS / 8, 'sha256'));
    const reference = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const opened = await open(reference, iv, header, sealed);
    expect(opened.ok && [...opened.bytes]).toEqual([...plaintext]);
  });

  it('derives from the NFC, trimmed passphrase, so composed and decomposed input agree', async () => {
    const composed = 'demo caf\u00e9 lantern brook stitch';
    const decomposed = '  demo cafe\u0301 lantern brook stitch\n';
    expect(normalisePassphrase(decomposed)).toBe(composed);
    const sealed = await seal(await deriveKey(composed, salt, TEST_ITERATIONS), iv, header, plaintext);
    expect((await open(await deriveKey(decomposed, salt, TEST_ITERATIONS), iv, header, sealed)).ok).toBe(true);
    // Case and inner spaces still count.
    const upper = await deriveKey(composed.toUpperCase(), salt, TEST_ITERATIONS);
    expect(await open(upper, iv, header, sealed)).toEqual({ ok: false, code: 'cannot-open' });
    const doubled = await deriveKey(composed.replace(' ', '  '), salt, TEST_ITERATIONS);
    expect(await open(doubled, iv, header, sealed)).toEqual({ ok: false, code: 'cannot-open' });
  });

  it('refuses a salt of the wrong length or a bad iteration count', async () => {
    await expect(deriveKey(passphrase, salt.slice(1), TEST_ITERATIONS)).rejects.toThrow(RangeError);
    await expect(deriveKey(passphrase, salt, 0)).rejects.toThrow(RangeError);
    await expect(deriveKey(passphrase, salt, 1.5)).rejects.toThrow(RangeError);
  });
});

describe('seal and open (Req 2.2, 2.3, 5.2)', () => {
  it('round-trips and appends a 16-byte tag', async () => {
    const sealed = await sealDemo();
    expect(TAG_BITS).toBe(128);
    expect(sealed).toHaveLength(plaintext.length + TAG_BYTES);
    const opened = await open(await deriveKey(passphrase, salt, TEST_ITERATIONS), iv, header, sealed);
    expect(opened.ok && [...opened.bytes]).toEqual([...plaintext]);
  });

  it('writes the same bytes as AES-256-GCM in Node crypto with the header as AAD', async () => {
    const raw = randomBytes(AES_KEY_BITS / 8);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const ours = await seal(key, iv, header, plaintext);
    const cipher = createCipheriv('aes-256-gcm', raw, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(header);
    const theirs = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
    expect([...ours]).toEqual([...theirs]);
  });

  it('fails with cannot-open for a wrong passphrase, salt or iteration count', async () => {
    const sealed = await sealDemo();
    const wrong = [
      await deriveKey(`${passphrase}x`, salt, TEST_ITERATIONS),
      await deriveKey(passphrase, flip(salt, 0), TEST_ITERATIONS),
      await deriveKey(passphrase, salt, TEST_ITERATIONS + 1),
    ];
    for (const key of wrong) expect(await open(key, iv, header, sealed)).toEqual({ ok: false, code: 'cannot-open' });
  });

  it('fails when any header byte given as additional data changes, even with the right key and IV', async () => {
    const sealed = await sealDemo();
    const key = await deriveKey(passphrase, salt, TEST_ITERATIONS);
    expect(header).toHaveLength(HEADER_BYTES);
    for (let at = 0; at < HEADER_BYTES; at += 1) {
      expect(await open(key, iv, flip(header, at), sealed)).toEqual({ ok: false, code: 'cannot-open' });
    }
    expect(await open(key, iv, new Uint8Array(0), sealed)).toEqual({ ok: false, code: 'cannot-open' });
  });

  it('fails when any byte of the ciphertext or tag, or the IV, changes', async () => {
    const sealed = await sealDemo();
    const key = await deriveKey(passphrase, salt, TEST_ITERATIONS);
    for (let at = 0; at < sealed.length; at += 1) {
      expect(await open(key, iv, header, flip(sealed, at, 0x80))).toEqual({ ok: false, code: 'cannot-open' });
    }
    expect(await open(key, flip(iv, IV_BYTES - 1), header, sealed)).toEqual({ ok: false, code: 'cannot-open' });
    expect(await open(key, iv, header, sealed.slice(0, TAG_BYTES - 1))).toEqual({ ok: false, code: 'cannot-open' });
    expect(await open(key, iv, header, sealed.slice(0, -1))).toEqual({ ok: false, code: 'cannot-open' });
  });

  it('refuses an IV of the wrong length', async () => {
    const key = await deriveKey(passphrase, salt, TEST_ITERATIONS);
    await expect(seal(key, new Uint8Array(16), header, plaintext)).rejects.toThrow(RangeError);
    await expect(open(key, new Uint8Array(8), header, plaintext)).rejects.toThrow(RangeError);
  });
});

describe('randomBytes (Req 2.1, 2.2)', () => {
  it('returns fresh bytes of the requested length', () => {
    const a = randomBytes(SALT_BYTES);
    const b = randomBytes(SALT_BYTES);
    expect(a).toHaveLength(SALT_BYTES);
    expect(randomBytes(IV_BYTES)).toHaveLength(IV_BYTES);
    // Equal only with probability 2^-128.
    expect([...a]).not.toEqual([...b]);
  });
});
