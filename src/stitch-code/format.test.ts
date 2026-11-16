import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ITERATIONS,
  HEADER_BYTES,
  ITERATION_BOUNDS,
  IV_BYTES,
  SALT_BYTES,
  TAG_BYTES,
  decodeHeader,
  encodeHeader,
  joinStitchCode,
} from './format';

const salt = Uint8Array.from({ length: SALT_BYTES }, (_, i) => i + 1);
const iv = Uint8Array.from({ length: IV_BYTES }, (_, i) => 0xa0 + i);
const sealed = new Uint8Array(TAG_BYTES + 3).fill(0x5a);

function code(iterations: number): Uint8Array {
  return joinStitchCode(encodeHeader(iterations, salt, iv), sealed);
}

describe('stitch-code header (Req 2.3, 2.4, 5.4)', () => {
  it('lays out magic, version, KDF ID, big-endian iterations, salt and IV in 36 bytes', () => {
    const h = encodeHeader(DEFAULT_ITERATIONS, salt, iv);
    expect(h).toHaveLength(HEADER_BYTES);
    expect([...h.slice(0, 4)]).toEqual([0x53, 0x46, 1, 1]);
    // 600,000 = 0x000927C0
    expect([...h.slice(4, 8)]).toEqual([0x00, 0x09, 0x27, 0xc0]);
    expect([...h.slice(8, 24)]).toEqual([...salt]);
    expect([...h.slice(24, 36)]).toEqual([...iv]);
  });

  it('decodes what it encodes and splits off the sealed bytes', () => {
    const decoded = decodeHeader(code(DEFAULT_ITERATIONS));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.header).toEqual({ version: 1, kdf: 1, iterations: 600_000, salt, iv });
    expect([...decoded.headerBytes]).toEqual([...encodeHeader(DEFAULT_ITERATIONS, salt, iv)]);
    expect([...decoded.sealed]).toEqual([...sealed]);
  });

  it('returns copies, so changing the input afterwards changes nothing', () => {
    const bytes = code(DEFAULT_ITERATIONS);
    const decoded = decodeHeader(bytes);
    bytes.fill(0);
    expect(decoded.ok && decoded.header.salt[0]).toBe(1);
    expect(decoded.ok && decoded.sealed[0]).toBe(0x5a);
  });

  it('round-trips any count, salt and IV under bounds that allow the count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 0xffff_ffff }),
        fc.uint8Array({ minLength: SALT_BYTES, maxLength: SALT_BYTES }),
        fc.uint8Array({ minLength: IV_BYTES, maxLength: IV_BYTES }),
        fc.uint8Array({ minLength: TAG_BYTES, maxLength: 64 }),
        (n, s, i, body) => {
          const decoded = decodeHeader(joinStitchCode(encodeHeader(n, s, i), body), { min: n, max: n });
          expect(decoded.ok).toBe(true);
          if (!decoded.ok) return;
          expect(decoded.header.iterations).toBe(n);
          expect([...decoded.header.salt]).toEqual([...s]);
          expect([...decoded.header.iv]).toEqual([...i]);
          expect([...decoded.sealed]).toEqual([...body]);
        },
      ),
    );
  });

  it('accepts exactly 600,000 to 10,000,000 iterations by default (Req 2.4)', () => {
    expect(ITERATION_BOUNDS).toEqual({ min: 600_000, max: 10_000_000 });
    expect(decodeHeader(code(600_000)).ok).toBe(true);
    expect(decodeHeader(code(10_000_000)).ok).toBe(true);
    expect(decodeHeader(code(599_999))).toEqual({ ok: false, code: 'not-stitch-code', problem: 'iterations' });
    expect(decodeHeader(code(10_000_001))).toEqual({ ok: false, code: 'not-stitch-code', problem: 'iterations' });
    expect(decodeHeader(code(1_000))).toMatchObject({ ok: false, problem: 'iterations' });
  });

  it('accepts a lower count only when the caller passes lower bounds explicitly', () => {
    expect(decodeHeader(code(1_000), { min: 1_000, max: 2_000 }).ok).toBe(true);
    expect(decodeHeader(code(2_001), { min: 1_000, max: 2_000 }).ok).toBe(false);
  });

  it.each([
    ['wrong magic', [0x50, 0x4b, 1, 1], 'magic'],
    ['unknown version', [0x53, 0x46, 2, 1], 'version'],
    ['unknown KDF', [0x53, 0x46, 1, 9], 'kdf'],
  ] as const)('rejects %s as not a stitch code (Req 5.4)', (_name, first4, problem) => {
    const bytes = code(DEFAULT_ITERATIONS);
    bytes.set(first4, 0);
    expect(decodeHeader(bytes)).toEqual({ ok: false, code: 'not-stitch-code', problem });
  });

  it('rejects input too short to hold a header and a tag', () => {
    expect(decodeHeader(new Uint8Array(0))).toMatchObject({ ok: false, problem: 'magic' });
    expect(decodeHeader(Uint8Array.of(0x53, 0x46))).toMatchObject({ ok: false, problem: 'version' });
    const full = code(DEFAULT_ITERATIONS);
    expect(decodeHeader(full.slice(0, HEADER_BYTES + TAG_BYTES - 1))).toMatchObject({ ok: false, problem: 'length' });
    expect(decodeHeader(full.slice(0, HEADER_BYTES + TAG_BYTES)).ok).toBe(true);
  });

  it('rejects text and other files that are not stitch codes', () => {
    const text = new TextEncoder().encode('https://example.com/not-a-stitch-code/'.repeat(3));
    expect(decodeHeader(text)).toMatchObject({ ok: false, code: 'not-stitch-code' });
    const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Uint8Array(60));
    expect(decodeHeader(png)).toMatchObject({ ok: false, code: 'not-stitch-code', problem: 'magic' });
  });

  it('refuses to encode bad salt, IV or iteration values', () => {
    expect(() => encodeHeader(0, salt, iv)).toThrow(RangeError);
    expect(() => encodeHeader(1.5, salt, iv)).toThrow(RangeError);
    expect(() => encodeHeader(2 ** 32, salt, iv)).toThrow(RangeError);
    expect(() => encodeHeader(DEFAULT_ITERATIONS, salt.slice(1), iv)).toThrow(RangeError);
    expect(() => encodeHeader(DEFAULT_ITERATIONS, salt, new Uint8Array(16))).toThrow(RangeError);
  });
});
