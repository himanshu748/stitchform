// Compression of the plaintext before it is encrypted (stitch-code Req 3.3, 3.4). Uses the
// platform CompressionStream and DecompressionStream in "deflate-raw" format: no zlib header or
// checksum, because the AES-GCM tag already authenticates the bytes. Both streams exist in the
// supported browsers and in Node 22, so the tests run in Vitest. Pure apart from those streams.

import type { Bytes } from './format';

/** Largest plaintext a stitch code may hold, before compression (Req 3.4). */
export const MAX_INFLATED_BYTES = 64 * 1024;

export type DeflateResult = { ok: true; bytes: Bytes } | { ok: false; code: 'too-large' };
export type InflateResult = { ok: true; bytes: Bytes } | { ok: false; code: 'too-large' | 'corrupt' };

function concat(chunks: readonly Uint8Array[], total: number): Bytes {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Read a stream to the end, or stop and cancel it as soon as more than `max` bytes have come out.
 * Rejects if the stream errors (DecompressionStream throws a TypeError for invalid data).
 */
async function collect(stream: ReadableStream<Uint8Array>, max: number): Promise<Bytes | 'too-large'> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return concat(chunks, total);
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return 'too-large';
    }
    chunks.push(value);
  }
}

/**
 * Compress with deflate-raw. Input over 64 KiB is refused, because a stitch code holding it could
 * never be opened again (Req 3.4).
 */
export async function deflateRaw(data: Bytes): Promise<DeflateResult> {
  if (data.length > MAX_INFLATED_BYTES) return { ok: false, code: 'too-large' };
  const out = await collect(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw')), Infinity);
  return out === 'too-large' ? { ok: false, code: 'too-large' } : { ok: true, bytes: out };
}

/**
 * Decompress deflate-raw bytes. Stops and fails with "too-large" as soon as the output passes
 * 64 KiB, so a small crafted input cannot fill memory (Req 3.4). Invalid, truncated or empty
 * input gives "corrupt". No partial output is ever returned.
 *
 * Bytes after the final deflate block are an error in the Compression Standard, but Node 22.14
 * ignores them (checked locally), so this function does not promise to reject them. In a stitch
 * code the input has already passed the AES-GCM tag check, so nobody but the app can add them.
 */
export async function inflateRaw(data: Bytes): Promise<InflateResult> {
  try {
    const out = await collect(
      new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
      MAX_INFLATED_BYTES,
    );
    return out === 'too-large' ? { ok: false, code: 'too-large' } : { ok: true, bytes: out };
  } catch {
    return { ok: false, code: 'corrupt' };
  }
}
