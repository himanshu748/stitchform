// Key derivation and authenticated encryption for stitch codes (stitch-code Req 1.5, 2.1, 2.2,
// 2.3). Web Crypto only, as documented on MDN and in the W3C Web Cryptography spec:
// crypto.getRandomValues for salt and IV, SubtleCrypto.importKey + deriveKey for
// PBKDF2-HMAC-SHA256 to a 256-bit AES-GCM key, and SubtleCrypto.encrypt/decrypt for AES-GCM with
// a 128-bit tag and the header bytes as additional data. encrypt returns the ciphertext with the
// tag appended (spec: "ciphertext be equal to C | T"). Runs in the browser and in Node 22.
// The passphrase only becomes key material here: it is never logged, stored or returned, and
// the derived key is not extractable.

import { IV_BYTES, SALT_BYTES, TAG_BYTES, type Bytes } from './format';

/** AES-GCM key size in bits (Req 2.1). */
export const AES_KEY_BITS = 256;
/** AES-GCM tag size in bits (Req 2.2). */
export const TAG_BITS = TAG_BYTES * 8;

export type OpenSealedResult = { ok: true; bytes: Bytes } | { ok: false; code: 'cannot-open' };

const utf8 = new TextEncoder();

/**
 * The form of a passphrase that keys are derived from: Unicode NFC, then trimmed, the same rule
 * as the custom passphrase check (Req 1.3). So a passphrase typed with a different keyboard or
 * input method, or with a stray space at the end, still opens the stitch code.
 */
export function normalisePassphrase(passphrase: string): string {
  return passphrase.normalize('NFC').trim();
}

/** Fresh random bytes from crypto.getRandomValues, for salts and IVs (Req 2.1, 2.2). */
export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derive the AES-GCM key with PBKDF2-HMAC-SHA256 (Req 2.1). Callers pass the iteration count
 * from the header; creating a stitch code always uses DEFAULT_ITERATIONS (600,000). The key can
 * only encrypt and decrypt and cannot be exported.
 */
export async function deriveKey(passphrase: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  if (salt.length !== SALT_BYTES) throw new RangeError(`salt must be ${SALT_BYTES} bytes`);
  if (!Number.isInteger(iterations) || iterations < 1) throw new RangeError('iterations must be a positive integer');
  const secret = utf8.encode(normalisePassphrase(passphrase));
  try {
    const material = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: AES_KEY_BITS },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    // The JS string cannot be wiped, but this copy of its bytes can.
    secret.fill(0);
  }
}

/**
 * Encrypt with AES-GCM (Req 2.2) and authenticate `additionalData`, the 36 header bytes, with it
 * (Req 2.3). Returns the ciphertext followed by the 16-byte tag. Each IV must be used once per
 * key; stitch codes get a fresh salt, so a fresh key, and a fresh IV every time.
 */
export async function seal(key: CryptoKey, iv: Bytes, additionalData: Bytes, plaintext: Bytes): Promise<Bytes> {
  if (iv.length !== IV_BYTES) throw new RangeError(`iv must be ${IV_BYTES} bytes`);
  const out = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData, tagLength: TAG_BITS }, key, plaintext);
  return new Uint8Array(out);
}

/**
 * Decrypt and check the tag. A wrong key (wrong passphrase, salt or iteration count), a changed
 * IV, header or ciphertext byte, or input shorter than the tag all make decrypt reject with an
 * OperationError, which becomes "cannot-open" with no partial data (Req 5.2). Other errors are
 * programming errors and are thrown.
 */
export async function open(key: CryptoKey, iv: Bytes, additionalData: Bytes, sealed: Bytes): Promise<OpenSealedResult> {
  if (iv.length !== IV_BYTES) throw new RangeError(`iv must be ${IV_BYTES} bytes`);
  try {
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData, tagLength: TAG_BITS }, key, sealed);
    return { ok: true, bytes: new Uint8Array(out) };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'OperationError') return { ok: false, code: 'cannot-open' };
    throw e;
  }
}
