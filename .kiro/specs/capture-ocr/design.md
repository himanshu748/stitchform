# Design: Form capture and OCR (F1)

Requirements: [requirements.md](requirements.md). Produces a `FormModel` (field-mapping design). Templates come from the sample-forms spec.

## External APIs (confirmed 2026-11-15)

| API | Used for | Source |
|---|---|---|
| `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` | camera preview. Secure contexts only (`navigator.mediaDevices` is undefined otherwise); errors include `NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError` | [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) |
| `MediaStreamTrack.stop()` | release the camera | [MDN MediaStreamTrack.stop](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop) |
| `<input type="file" accept="image/png,image/jpeg,image/webp">` | upload | [MDN input type=file](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file) |
| Canvas 2D `drawImage`, `getImageData`, `putImageData` | scaling, greyscale, contrast | [MDN CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) |
| Tesseract.js 7.0.0 (Apache-2.0) `createWorker(langs, oem, options)` with `langs = ["eng", "hin"]`, `oem = OEM.LSTM_ONLY`, `options = { workerPath, corePath, langPath, logger }` | worker creation, self-hosted files | [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/v7.0.0/docs/api.md), [local installation](https://github.com/naptha/tesseract.js/blob/v7.0.0/docs/local-installation.md), type declarations `src/index.d.ts` at v7.0.0 |
| `worker.recognize(image, { rotateAuto: true }, { blocks: true })` | OCR. Since v6 only `text` is returned unless other outputs are requested. `blocks[].paragraphs[].lines[].words[]` each carry `text`, `confidence` and `bbox {x0, y0, x1, y1}`. No exception when no text is found. `image` may be a `canvas` element. | [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/v7.0.0/docs/api.md), [image formats](https://github.com/naptha/tesseract.js/blob/v7.0.0/docs/image-format.md), [v6 changes](https://github.com/naptha/tesseract.js/issues/993) |
| `worker.terminate()` | free memory | [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/v7.0.0/docs/api.md) |

Self-hosting rules from the local-installation doc: `corePath` must be a **directory** holding all four core builds (`tesseract-core.wasm.js`, `tesseract-core-simd.wasm.js`, `tesseract-core-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js`); language URLs are `langPath + langCode + ".traineddata.gz"`; `langPath` has no trailing slash.

Packages and data:

- `tesseract.js@7.0.0` depends on `tesseract.js-core@^7.0.0` (`npm view`). Note: the npm `latest` tag of `tesseract.js-core` is still 6.1.2 while 7.0.0 exists; the version installed through `tesseract.js` is the one copied, and the copy script checks it.
- Language data: `eng.traineddata.gz` and `hin.traineddata.gz` from `https://tessdata.projectnaptha.com/4.0.0/` (the default in the docs; `hin` returned HTTP 200 on 2026-11-15), source repository [naptha/tessdata](https://github.com/naptha/tessdata), licence Apache-2.0. Downloaded once by a script into `public/tesseract/lang/` and committed, so the app never contacts that host.

## Module layout

```
src/capture/
  camera.ts         openCamera, capturePhoto, stopCamera (DOM)
  upload.ts         readImageFile (DOM)
  preprocess.ts     toWorkingCanvas: scale, greyscale, contrast (DOM; pixel math in pure helpers)
  pixels.ts         greyscale and contrast stretch on Uint8ClampedArray (pure, unit tested)
src/ocr/
  worker.ts         getWorker (single instance), recognise(canvas) -> OcrWords (DOM, worker)
  words.ts          flatten blocks -> OcrWord[] with normalised boxes (pure)
  detect-sample.ts  matchSampleTitle, alignTemplate (pure)
  detect-generic.ts proposeFields from lines (pure)
  index.ts          detectFields(canvas) -> { form: FormModel; mode: "sample" | "generic" }
scripts/copy-ocr-assets.mjs   copies worker.min.js and the 4 core files from node_modules, fetches lang data once
public/tesseract/{worker.min.js, core/, lang/}
```

## Types

```ts
export interface OcrWord { text: string; confidence: number; box: BBox; line: number } // box in page fractions
export interface DetectedLabel { text: string; box: BBox; synonymKey?: string }
```

## Detection

1. `words.ts` divides each Tesseract `bbox` by the canvas width and height to get page fractions (Req 4.4).
2. `matchSampleTitle` compares normalised OCR lines (field-mapping `normaliseLabel`) to the three sample titles. A match loads `public/samples/<id>.template.json`.
3. `alignTemplate` finds template labels in the OCR words and fits a scale-and-translate transform by least squares on label centres (rotation is already corrected by `rotateAuto`). With fewer than 3 matched labels it keeps the template boxes unaligned and tells the user to check them.
4. `proposeFields` (generic mode) picks lines that match a synonym or end in ":"; the box spans from the end of the label to the next label on the same line or the right margin, with the label's line height. Type comes from the synonym key (Req 4.3).
5. The result goes to the field editor in lab-ui for confirmation (Req 4.5).

## Error handling

| Case | Behaviour |
|---|---|
| No `navigator.mediaDevices` or `NotAllowedError` | Message plus upload button (Req 1.2) |
| `NotFoundError`, `NotReadableError`, `OverconstrainedError` | Retry without `facingMode`, then fall back to upload |
| Unsupported file type | Message (Req 1.4) |
| Worker or WebAssembly load failure | Message, offer samples and manual fields (Req 3.5) |
| Zero words | Same as above; not an exception per the docs |

The image never leaves memory (Req 1.5); `URL.revokeObjectURL` is called for any object URL created for previews.

## Correctness properties

P1 to P5 are owned by other specs. Local checks:

- `pixels.ts`: greyscale output is within 0 to 255 and contrast stretch is monotonic (unit tests).
- `words.ts`: every normalised box lies within 0 to 1 for any `bbox` inside the canvas (a small fast-check property).
- `alignTemplate`: aligning a template to its own label positions is the identity (unit test).

## Testing

- Unit tests for the pure helpers with synthetic word lists, labelled demo data.
- One integration test, run only by `npm run test:ocr` (not in `npm test`, because it loads WebAssembly and takes seconds), that recognises each sample PNG in Node with the self-hosted language data and checks that the sample is matched.
- Manual check on the three "crumpled" images with timings recorded (Req 5.3).
