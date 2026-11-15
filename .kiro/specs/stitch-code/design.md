# Design: QR stitch code (F7)

Requirements: [requirements.md](requirements.md). Uses `FormModel`, `Answer`, `MappingResult` from the field-mapping design.

## External APIs (all confirmed in the linked docs on 2026-11-15)

| API | Used for | Source |
|---|---|---|
| `crypto.getRandomValues(typedArray)` | passphrase words, salt, IV. Throws `QuotaExceededError` above 65,536 bytes (we request at most 16). | [MDN Crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues) |
| `SubtleCrypto.importKey("raw", bytes, "PBKDF2", false, ["deriveKey"])` | passphrase as key material | [MDN SubtleCrypto.deriveKey, PBKDF2 example](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey) |
| `SubtleCrypto.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])` | key derivation | [MDN deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [MDN Pbkdf2Params](https://developer.mozilla.org/en-US/docs/Web/API/Pbkdf2Params) (salt "at least 16 bytes") |
| `SubtleCrypto.encrypt / decrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, data)` | encryption; `decrypt` rejects with `OperationError` when authentication fails | [MDN AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) (96-bit IV recommended, never reuse an IV with a key, tag defaults to 128), [MDN SubtleCrypto.decrypt](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt) |
| `new CompressionStream("deflate-raw")`, `new DecompressionStream("deflate-raw")` | compression. MDN browser-compat-data: `deflate-raw` from Chrome 103, Firefox 113, Safari 16.4. Also present in Node 22 (checked locally), so tests run in Vitest. | [MDN CompressionStream()](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream), [browser-compat-data](https://github.com/mdn/browser-compat-data/blob/main/api/CompressionStream.json) |
| `qrcode` 1.5.4 (MIT): `QRCode.toDataURL(segments, { errorCorrectionLevel: "M" })` with `[{ data: Uint8ClampedArray, mode: "byte" }]`; promise form when no callback is given | QR encoding of binary data. Byte-mode capacity at level M is 2,331 bytes. | [node-qrcode README](https://github.com/soldair/node-qrcode#readme): "Binary data", "Error correction level", "QR Code capacity", "ES6/ES7" sections |
| `jsqr` 1.4.0 (Apache-2.0): `jsQR(imageData, width, height, { inversionAttempts })` returns `{ binaryData, data, ... }` or `null` | QR decoding from camera frames or images, pure JS with no network | [jsQR README](https://github.com/cozmo/jsQR#usage) |
| `CanvasRenderingContext2D.getImageData` | pixels for jsQR | [MDN getImageData](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData) |
| `MediaDevices.getUserMedia({ video: { facingMode: "environment" } })` | camera scanning; secure contexts only | [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) |

Library choice: `qrcode` is the most used MIT encoder with documented byte-mode input. `jsqr` is pure JavaScript, needs no WebAssembly or CDN download, and returns raw bytes; its last release was 1.4.0 on 2021-04-24 (npm), so it is stable but not actively developed. Alternatives checked on npm: `lean-qr` (MIT, encoder), `barcode-detector` (MIT polyfill built on WebAssembly). Neither is needed.

Bundled data:

- Word list: the [EFF large wordlist](https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt) (7,776 lines, checked), used under CC BY 4.0 per [EFF's copyright page](https://www.eff.org/copyright) ("original material on the EFF website may be freely distributed ... under the Creative Commons Attribution 4.0 International License"). Attribution goes in README "Pre-existing work" and the About panel.
- Common passwords: `Passwords/Common-Credentials/10k-most-common.txt` from [SecLists](https://github.com/danielmiessler/SecLists) (repository licence MIT). Only entries of 16 or more characters can matter (shorter ones already fail Req 1.3), so the bundled file keeps the full list for the check but it is lazy-loaded with the passphrase dialog.

## Module layout

```
src/stitch-code/
  format.ts        header layout, encodeHeader, decodeHeader (pure)
  passphrase.ts    generatePassphrase(words, rng), checkCustomPassphrase(p, commonSet) (pure)
  crypto.ts        deriveKey, seal, open (Web Crypto, runs in browser and Node 22)
  compress.ts      deflateRaw, inflateRaw with a 64 KiB output cap
  payload.ts       toPayload(formId, answers), fromPayload(bytes)
  qr.ts            toQrDataUrl(bytes) -> string | "too-large"; decodeQr(imageData) (browser only)
  index.ts         createStitchCode, openStitchCode
public/wordlists/eff_large_wordlist.txt, public/wordlists/common-passwords.txt
```

`crypto.ts`, `compress.ts`, `format.ts`, `passphrase.ts` and `payload.ts` take no DOM dependency, so P3 runs in Vitest.

## Byte format (version 1)

| Offset | Length | Field |
|---|---|---|
| 0 | 2 | Magic `0x53 0x46` ("SF") |
| 2 | 1 | Format version `1` |
| 3 | 1 | KDF ID `1` = PBKDF2-HMAC-SHA256 |
| 4 | 4 | Iterations, unsigned 32-bit big-endian (600,000 when created) |
| 8 | 16 | Salt |
| 24 | 12 | IV |
| 36 | n + 16 | AES-GCM ciphertext followed by the 16-byte tag |

The 36 header bytes are passed as `additionalData` (Req 2.3). Overhead is 52 bytes, leaving about 2,279 bytes of compressed answers for one level-M QR code.

Plaintext before compression: UTF-8 JSON `{"v":1,"f":"<formId>","a":[["<fieldId>","<text>"], ...]}` built from `toPromptedAnswers` (Req 3.1). Signatures and images are never included (Req 3.2).

## Flows

```
create: answers -> payload JSON -> deflate-raw -> random salt, IV -> PBKDF2 (600k) -> AES-GCM(AAD = header)
        -> header || ciphertext -> QR (byte mode, level M) or .stitch file
open:   QR / file -> bytes -> decodeHeader (magic, version, KDF, 600k <= iterations <= 10M)
        -> PBKDF2 -> AES-GCM decrypt (throws OperationError on wrong passphrase or tampering)
        -> inflate-raw (cap 64 KiB) -> JSON schema check -> answers -> mapAnswers
```

## Passphrase generation (Req 1.1)

Draw a `Uint16Array(1)` with `getRandomValues`; accept values below 62,208 (8 x 7,776) and take `value % 7776`; otherwise draw again. This rejection sampling gives each word probability exactly 1/7,776. Five words give log2(7776^5), about 64.6 bits. The RNG is injected so tests can check uniformity of the index mapping without randomness.

## Error handling

| Case | Detection | Message (Req) |
|---|---|---|
| Not a stitch code | magic or version mismatch | "This is not a Stitchform stitch code" (5.4) |
| Iteration count out of range | header check | same as above, no derivation attempted (2.4) |
| Wrong passphrase or tampered bytes | `decrypt` rejects with `OperationError` | "This stitch code could not be opened with that passphrase" (5.2) |
| Decompressed size over 64 KiB or invalid JSON | `compress.ts`, `payload.ts` | treated as 5.2, no partial data |
| Different form | payload `f` differs | ask before refilling (5.3) |
| QR too large | byte length over 2,331, checked before calling the encoder; any encoder error is handled the same way | offer `.stitch` file (4.2) |
| Camera denied or insecure context | `NotAllowedError`, `navigator.mediaDevices` undefined | offer image upload or file instead (4.3) |

Nothing is logged except error codes (steering: no answers or passphrases in logs).

## Correctness properties

This spec owns P3.

| ID | Property | Requirement IDs | Owner spec | Test file |
|---|---|---|---|---|
| P1 | Required fields after mapping are filled with valid values or flagged. Also checked after refill from a stitch code. | field-mapping 5.1, 5.2, 5.4; validation 4.1 | field-mapping | `src/mapping/map-answers.property.test.ts` |
| P2 | Date round-trip for every supported format, including Devanagari digits. | validation 1.1, 1.2, 1.4, 1.8 | validation | `src/validation/dates.property.test.ts` |
| P3 | For any form ID and answers (`fc.array` of `[fieldId, fc.string({ unit: "grapheme" })]`) and any passphrase, `open(seal(x, p), p)` equals `x`; for any `q !== p`, `open(seal(x, p), q)` fails; flipping any one byte of the output makes `open` fail. | stitch-code 5.1, 5.2, 2.3, 3.4 | stitch-code | `src/stitch-code/round-trip.property.test.ts` |
| P4 | Mapping is idempotent, so a refill gives the same result as the original session. | field-mapping 6.1, 6.2 | field-mapping | `src/mapping/map-answers.property.test.ts` |
| P5 | No LLM output marks a field filled with an invalid value. | llm-adapter 5.1, 5.2, 5.3 | llm-adapter | `src/llm/merge.property.test.ts` |

P3 uses `fc.asyncProperty`. To keep the test fast, the property calls the internal `sealWithIterations` with a low iteration count (1,000), and one example test checks that the public `createStitchCode` writes 600,000 into the header. This is a deliberate test-only shortcut and is noted in KIRO_USAGE.md when it is written.

## Testing

- Unit: header encode/decode, iteration bounds, rejection sampling with a scripted RNG, custom passphrase rules, 64 KiB cap with a crafted payload.
- Property: P3 as above.
- Manual (recorded honestly): PBKDF2 time on a low-end phone and on a laptop (Req 2.5), QR scan from a printed page.
