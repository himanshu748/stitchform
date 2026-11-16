// Tests for the QR image of a stitch code (Req 4.1, 4.2). To check that the bytes survive, the
// tests scan with jsQR, the decoder the app uses for scanning (task 9). In Node, qrcode draws its
// PNG with pngjs and this repo has no PNG decoder, so the scan reads pixels drawn here from the
// module matrix of exactly the segments and options that toQrDataUrl handed to the encoder.
// The form ID, answers and passphrase are SAMPLE / DEMO DATA.

import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StitchPayload } from './payload';
import { QR_MAX_BYTES, toQrDataUrl, type QrImageResult } from './qr';
import { openWithBounds, sealWithIterations } from './stitch-code';

afterEach(() => {
  vi.restoreAllMocks();
});

type EncoderInput = Parameters<typeof QRCode.create>;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const DATA_URL_PREFIX = 'data:image/png;base64,';

/** Bytes that take every value from 0 to 255 once in each run of 256. */
function bytesOf(length: number): Uint8Array<ArrayBuffer> {
  return Uint8Array.from({ length }, (_, i) => (i * 167 + 13) % 256);
}

/** Run toQrDataUrl with the real encoder and return what it was asked to encode. */
async function encode(bytes: Uint8Array): Promise<{ result: QrImageResult; input: EncoderInput }> {
  const spy = vi.spyOn(QRCode, 'toDataURL');
  const result = await toQrDataUrl(bytes);
  expect(spy).toHaveBeenCalledTimes(1);
  const input = spy.mock.calls[0] as unknown as EncoderInput;
  spy.mockRestore();
  return { result, input };
}

/** Draw the symbol for `input` with a 4-module quiet zone, 4 pixels per module, and scan it. */
function scan(input: EncoderInput): { bytes: number[]; version: number } | null {
  const { modules } = QRCode.create(...input);
  const margin = 4;
  const scale = 4;
  const width = (modules.size + 2 * margin) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (!modules.get(row, col)) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const p = (((row + margin) * scale + dy) * width + (col + margin) * scale + dx) * 4;
          pixels.fill(0, p, p + 3);
        }
      }
    }
  }
  const code = jsQR(pixels, width, width, { inversionAttempts: 'dontInvert' });
  return code === null ? null : { bytes: [...code.binaryData], version: code.version };
}

describe('QR image (Req 4.1)', () => {
  it('asks for one byte-mode segment at level M and returns a PNG data URL', async () => {
    const bytes = bytesOf(300);
    const { result, input } = await encode(bytes);
    expect(input[0]).toEqual([{ data: Uint8ClampedArray.from(bytes), mode: 'byte' }]);
    // toMatchObject, because the encoder writes its renderer defaults into the options it is given.
    expect(input[1]).toMatchObject({ errorCorrectionLevel: 'M' });
    if (!result.ok) throw new Error('expected a QR image');
    expect(result.dataUrl.startsWith(DATA_URL_PREFIX)).toBe(true);
    const png = Buffer.from(result.dataUrl.slice(DATA_URL_PREFIX.length), 'base64');
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  });

  it.each([1, 52, 1_000, QR_MAX_BYTES])('scans a %i-byte code back to exactly the same bytes', async (length) => {
    const bytes = bytesOf(length);
    const { result, input } = await encode(bytes);
    expect(result.ok).toBe(true);
    expect(scan(input)?.bytes).toEqual([...bytes]);
  });

  it('fits 2,331 bytes in a single version 40 symbol', async () => {
    const { input } = await encode(bytesOf(QR_MAX_BYTES));
    expect(scan(input)?.version).toBe(40);
  });

  it('a stitch code for demo answers fits, scans and opens with the passphrase', async () => {
    const passphrase = 'demo lantern stitch hollow brook';
    const payload: StitchPayload = {
      formId: 'sample-hollowbrook-hostel',
      answers: [
        ['full-name', 'Demo Applicant'],
        ['city', 'नमूना नगर'],
        ['dob', '14/08/2005'],
        ['room-type', 'Single (demo)'],
      ],
    };
    const sealed = await sealWithIterations(payload, passphrase, 1_000);
    if (!sealed.ok) throw new Error('expected a stitch code');
    const { result, input } = await encode(sealed.bytes);
    expect(result.ok).toBe(true);
    const scanned = scan(input);
    if (scanned === null) throw new Error('expected the QR code to scan');
    expect(await openWithBounds(Uint8Array.from(scanned.bytes), passphrase, { min: 1_000, max: 1_000 })).toEqual({
      ok: true,
      payload,
    });
  });
});

describe('too large for one QR code (Req 4.2)', () => {
  it('uses the same limit as the encoder for byte mode at level M', () => {
    const at = (n: number): EncoderInput => [[{ data: new Uint8ClampedArray(n), mode: 'byte' }], { errorCorrectionLevel: 'M' }];
    expect(QRCode.create(...at(QR_MAX_BYTES)).version).toBe(40);
    expect(() => QRCode.create(...at(QR_MAX_BYTES + 1))).toThrow();
  });

  it.each([QR_MAX_BYTES + 1, 64 * 1024])('refuses %i bytes without calling the encoder', async (length) => {
    const spy = vi.spyOn(QRCode, 'toDataURL');
    expect(await toQrDataUrl(bytesOf(length))).toEqual({ ok: false, code: 'too-large' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('treats an encoder rejection as too large', async () => {
    vi.spyOn(QRCode, 'toDataURL').mockRejectedValueOnce(new Error('demo encoder failure'));
    expect(await toQrDataUrl(bytesOf(100))).toEqual({ ok: false, code: 'too-large' });
  });

  it('treats an encoder that throws straight away as too large', async () => {
    vi.spyOn(QRCode, 'toDataURL').mockImplementationOnce(() => {
      throw new Error('demo encoder failure');
    });
    expect(await toQrDataUrl(bytesOf(100))).toEqual({ ok: false, code: 'too-large' });
  });
});
