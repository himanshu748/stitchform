import { deflateRawSync, inflateRawSync } from 'node:zlib';
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_INFLATED_BYTES, deflateRaw, inflateRaw } from './compress';

const utf8 = new TextEncoder();

/** Raw deflate made by Node's zlib, used to build inputs that deflateRaw itself refuses to make. */
function zlibDeflate(data: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(deflateRawSync(data));
}

async function roundTrip(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const packed = await deflateRaw(data);
  if (!packed.ok) throw new Error(packed.code);
  const unpacked = await inflateRaw(packed.bytes);
  if (!unpacked.ok) throw new Error(unpacked.code);
  return unpacked.bytes;
}

describe('deflateRaw and inflateRaw (Req 3.3)', () => {
  it('round-trips a stitch-code style JSON payload with Hindi text', async () => {
    // SAMPLE / DEMO DATA: invented answers for a fictional form.
    const json = '{"v":1,"f":"sample-hollowbrook-hostel","a":[["full-name","Demo Applicant"],["city","नमूना नगर"]]}';
    const back = await roundTrip(utf8.encode(json));
    expect(new TextDecoder().decode(back)).toBe(json);
  });

  it('round-trips any bytes, including empty input', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 4096 }), async (data) => {
        const copy = new Uint8Array(data);
        expect([...(await roundTrip(copy))]).toEqual([...data]);
      }),
    );
  });

  it('writes raw deflate with no zlib header, readable by another implementation', async () => {
    const text = 'demo answer '.repeat(50);
    const packed = await deflateRaw(utf8.encode(text));
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    expect(packed.bytes.length).toBeLessThan(text.length / 4);
    expect(inflateRawSync(packed.bytes).toString('utf8')).toBe(text);
  });
});

describe('64 KiB limit (Req 3.4)', () => {
  it('compresses exactly 64 KiB and refuses one byte more', async () => {
    expect(MAX_INFLATED_BYTES).toBe(65_536);
    const atLimit = new Uint8Array(MAX_INFLATED_BYTES).fill(0x61);
    expect([...(await roundTrip(atLimit))]).toEqual([...atLimit]);
    expect(await deflateRaw(new Uint8Array(MAX_INFLATED_BYTES + 1))).toEqual({ ok: false, code: 'too-large' });
  });

  it('inflates output of exactly 64 KiB and fails with too-large one byte past it', async () => {
    const atLimit = await inflateRaw(zlibDeflate(new Uint8Array(MAX_INFLATED_BYTES)));
    expect(atLimit.ok && atLimit.bytes.length).toBe(MAX_INFLATED_BYTES);
    expect(await inflateRaw(zlibDeflate(new Uint8Array(MAX_INFLATED_BYTES + 1)))).toEqual({ ok: false, code: 'too-large' });
  });

  describe('with a crafted payload', () => {
    const RealDecompressionStream = globalThis.DecompressionStream;
    let produced = 0;

    /** Passes the real decompressor's output through unchanged and counts the bytes read from it. */
    class CountingDecompressionStream {
      readonly writable: WritableStream<BufferSource>;
      readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>;
      constructor(format: CompressionFormat) {
        const real = new RealDecompressionStream(format);
        this.writable = real.writable;
        this.readable = real.readable.pipeThrough(
          new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>({
            transform(chunk, controller) {
              produced += chunk.length;
              controller.enqueue(chunk);
            },
          }),
        );
      }
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('stops reading soon after 64 KiB, so a 16 MiB bomb is never inflated in full', async () => {
      const full = 16 * 1024 * 1024;
      const bomb = zlibDeflate(new Uint8Array(full));
      expect(bomb.length).toBeLessThan(20_000);
      produced = 0;
      vi.stubGlobal('DecompressionStream', CountingDecompressionStream);
      expect(await inflateRaw(bomb)).toEqual({ ok: false, code: 'too-large' });
      expect(produced).toBeGreaterThan(MAX_INFLATED_BYTES);
      // A few decompressor chunks past the cap at most, against 16 MiB for the whole payload.
      expect(produced).toBeLessThan(4 * MAX_INFLATED_BYTES);
    });
  });
});

describe('inflateRaw on bad input (Req 3.4, 5.2)', () => {
  it.each([
    ['empty input', new Uint8Array(0)],
    ['bytes that are not deflate data', new Uint8Array(40).fill(0xff)],
    ['a reserved block type', Uint8Array.of(0x07, 0x00)],
  ])('gives corrupt for %s', async (_name, data) => {
    expect(await inflateRaw(data)).toEqual({ ok: false, code: 'corrupt' });
  });

  it('gives corrupt for a truncated stream and returns no partial output', async () => {
    const packed = zlibDeflate(utf8.encode('{"v":1,"f":"demo","a":[["name","Demo Person"]]}'));
    for (let cut = 0; cut < packed.length; cut += 1) {
      expect(await inflateRaw(packed.slice(0, cut))).toEqual({ ok: false, code: 'corrupt' });
    }
  });
});
