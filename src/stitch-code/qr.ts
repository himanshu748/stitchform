// QR image of a stitch code (stitch-code Req 4.1, 4.2), drawn by `qrcode` 1.5.4. Per the
// node-qrcode README: binary data must be passed as a byte-mode segment holding a
// Uint8ClampedArray ("Binary data"; a JavaScript string would add bytes), `toDataURL` returns a
// promise when no callback is given ("ES6/ES7"), and byte mode at level M holds at most 2,331
// bytes ("QR Code capacity"). Longer codes are refused before the encoder runs, and any encoder
// error is treated the same way, because the caller then offers the same bytes as a `.stitch`
// file, which always works (Req 4.2). The bytes are already encrypted; nothing here logs them.
// Decoding from camera frames and uploaded images is stitch-code task 9 (lab-ui milestone).

import QRCode from 'qrcode';

/** Most bytes one QR code holds in byte mode at error-correction level M (version 40). */
export const QR_MAX_BYTES = 2_331;

/**
 * `dataUrl` is a PNG data URL of one QR code. "too-large" means the caller says so and offers
 * the `.stitch` file download instead (Req 4.2).
 */
export type QrImageResult = { ok: true; dataUrl: string } | { ok: false; code: 'too-large' };

/** Draw the stitch code bytes as one QR code in byte mode at level M (Req 4.1). */
export async function toQrDataUrl(bytes: Uint8Array): Promise<QrImageResult> {
  const tooLarge: QrImageResult = { ok: false, code: 'too-large' };
  if (bytes.length > QR_MAX_BYTES) return tooLarge;
  try {
    const dataUrl = await QRCode.toDataURL([{ data: Uint8ClampedArray.from(bytes), mode: 'byte' }], {
      errorCorrectionLevel: 'M',
    });
    return { ok: true, dataUrl };
  } catch {
    return tooLarge;
  }
}
