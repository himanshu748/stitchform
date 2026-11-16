// Byte format of a stitch code, version 1 (stitch-code design "Byte format", Req 2.3, 2.4, 5.4).
// Pure: no I/O, no Web Crypto. The 36 header bytes are authenticated as AES-GCM additional data
// by crypto.ts, so any change to them makes opening fail.
//
// | Offset | Length | Field                                              |
// |--------|--------|----------------------------------------------------|
// | 0      | 2      | Magic 0x53 0x46 ("SF")                             |
// | 2      | 1      | Format version 1                                   |
// | 3      | 1      | KDF ID 1 = PBKDF2-HMAC-SHA256                      |
// | 4      | 4      | Iterations, unsigned 32-bit big-endian             |
// | 8      | 16     | Salt                                               |
// | 24     | 12     | IV                                                 |
// | 36     | n + 16 | AES-GCM ciphertext followed by the 16-byte tag     |

/** Bytes backed by a plain ArrayBuffer, which is what Web Crypto and Blob accept. */
export type Bytes = Uint8Array<ArrayBuffer>;

export const MAGIC: readonly number[] = Object.freeze([0x53, 0x46]);
export const FORMAT_VERSION = 1;
export const KDF_PBKDF2_SHA256 = 1;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;
export const HEADER_BYTES = 36;

/** Iteration count written into every stitch code the app creates (Req 2.1). */
export const DEFAULT_ITERATIONS = 600_000;

export interface IterationBounds {
  readonly min: number;
  readonly max: number;
}

/** Counts accepted when reading a stitch code (Req 2.4). Tests may pass lower bounds explicitly. */
export const ITERATION_BOUNDS: IterationBounds = Object.freeze({ min: 600_000, max: 10_000_000 });

export interface StitchHeader {
  version: typeof FORMAT_VERSION;
  kdf: typeof KDF_PBKDF2_SHA256;
  iterations: number;
  salt: Bytes;
  iv: Bytes;
}

/** Why bytes were not accepted as a stitch code. All of them show the Req 5.4 message. */
export type HeaderProblem = 'length' | 'magic' | 'version' | 'kdf' | 'iterations';

export type DecodedStitchCode =
  | { ok: true; header: StitchHeader; headerBytes: Bytes; sealed: Bytes }
  | { ok: false; code: 'not-stitch-code'; problem: HeaderProblem };

const MAX_U32 = 0xffff_ffff;

/** Write the 36 header bytes. Throws RangeError for a programming error (bad lengths or count). */
export function encodeHeader(iterations: number, salt: Uint8Array, iv: Uint8Array): Bytes {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_U32) {
    throw new RangeError('iterations must be an integer from 1 to 2^32 - 1');
  }
  if (salt.length !== SALT_BYTES) throw new RangeError(`salt must be ${SALT_BYTES} bytes`);
  if (iv.length !== IV_BYTES) throw new RangeError(`iv must be ${IV_BYTES} bytes`);
  const out = new Uint8Array(HEADER_BYTES);
  out.set(MAGIC, 0);
  out[2] = FORMAT_VERSION;
  out[3] = KDF_PBKDF2_SHA256;
  new DataView(out.buffer).setUint32(4, iterations, false);
  out.set(salt, 8);
  out.set(iv, 8 + SALT_BYTES);
  return out;
}

/** Header bytes followed by the sealed bytes (ciphertext and tag). */
export function joinStitchCode(headerBytes: Uint8Array, sealed: Uint8Array): Bytes {
  const out = new Uint8Array(headerBytes.length + sealed.length);
  out.set(headerBytes, 0);
  out.set(sealed, headerBytes.length);
  return out;
}

/**
 * Read and check the header of a stitch code: magic, version, KDF ID and the iteration count
 * against `bounds` (Req 2.4, 5.4), and that at least a full tag follows. Nothing is derived or
 * decrypted here. The returned arrays are copies, so later changes to `bytes` do not leak in.
 */
export function decodeHeader(bytes: Uint8Array, bounds: IterationBounds = ITERATION_BOUNDS): DecodedStitchCode {
  const fail = (problem: HeaderProblem): DecodedStitchCode => ({ ok: false, code: 'not-stitch-code', problem });
  // A missing byte reads as undefined and so counts as a mismatch of the field it belongs to.
  if (bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1]) return fail('magic');
  if (bytes[2] !== FORMAT_VERSION) return fail('version');
  if (bytes[3] !== KDF_PBKDF2_SHA256) return fail('kdf');
  if (bytes.length < HEADER_BYTES + TAG_BYTES) return fail('length');
  const headerBytes = bytes.slice(0, HEADER_BYTES);
  const iterations = new DataView(headerBytes.buffer).getUint32(4, false);
  if (iterations < bounds.min || iterations > bounds.max) return fail('iterations');
  return {
    ok: true,
    header: {
      version: FORMAT_VERSION,
      kdf: KDF_PBKDF2_SHA256,
      iterations,
      salt: headerBytes.slice(8, 8 + SALT_BYTES),
      iv: headerBytes.slice(8 + SALT_BYTES, HEADER_BYTES),
    },
    headerBytes,
    sealed: bytes.slice(HEADER_BYTES),
  };
}
