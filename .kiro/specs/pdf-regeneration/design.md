# Design: PDF regeneration (F6)

Requirements: [requirements.md](requirements.md). Inputs: `FormModel` and `MappingResult` (field-mapping design), signature images from lab-ui, and either the sample PDF (sample-forms) or the processed capture image (capture-ocr).

## External APIs (confirmed 2026-11-15)

| API | Facts used | Source |
|---|---|---|
| `PDFDocument.create()`, `pdfDoc.addPage([w, h])`, `page.getSize()`, `pdfDoc.save()` (returns `Uint8Array`) | build and serialise | [pdf-lib README](https://github.com/Hopding/pdf-lib#readme), Context7 `/hopding/pdf-lib` |
| `pdfDoc.embedPdf(bytes, [pageIndices])` and `page.drawPage(embeddedPage, { x, y, xScale, yScale })` | draw the original sample page as the background | Context7 `/hopding/pdf-lib` (source `apps/web/test1.html`), [pdf-lib README](https://github.com/Hopding/pdf-lib#readme) "Embed PDF Pages" |
| `pdfDoc.embedPng(bytes)`, `pdfDoc.embedJpg(bytes)`, `page.drawImage(img, { x, y, width, height })`, `img.scale(f)` | photo background, signatures, Devanagari text images | [pdf-lib README](https://github.com/Hopding/pdf-lib#readme) "Embed PNG and JPEG Images" |
| `pdfDoc.embedFont(StandardFonts.Helvetica)`; standard fonts use WinAnsi (Windows-1252) and drawing an unsupported character throws (`WinAnsi cannot encode ...`) | Latin text | [pdf-lib README](https://github.com/Hopding/pdf-lib#readme) "Fonts and Unicode" |
| `page.drawText(text, { x, y, size, font, color })`, `font.widthOfTextAtSize(text, size)`, `font.heightAtSize(size)`, `rgb(r, g, b)`, `page.drawRectangle`, `page.drawLine` | text fitting, boxes, ticks | [pdf-lib README](https://github.com/Hopding/pdf-lib#readme) "Embed Font and Measure Text", "Draw Text" |
| Coordinates: origin at bottom-left (the README example draws at `y: height - 4 * fontSize` to place text near the top) | box conversion | [pdf-lib README](https://github.com/Hopding/pdf-lib#readme) "Create Document" |
| `pdfDoc.registerFontkit(fontkit)` then `pdfDoc.embedFont(fontBytes, { subset: true })` with `@pdf-lib/fontkit` | custom fonts | [pdf-lib README](https://github.com/Hopding/pdf-lib#readme) "Embed Font", [EmbedFontOptions.subset](https://pdf-lib.js.org/docs/api/interfaces/embedfontoptions#optional-subset) |
| `setTitle`, `setProducer`, `setCreator` | metadata (no answers) | [pdf-lib README](https://github.com/Hopding/pdf-lib#readme) "Set Document Metadata" |
| `new FontFace(family, arrayBuffer)`, `document.fonts.add(face)`, `face.load()` | load Noto Sans Devanagari for canvas text | [MDN FontFace()](https://developer.mozilla.org/en-US/docs/Web/API/FontFace/FontFace), [MDN FontFaceSet.add](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/add) |
| `CanvasRenderingContext2D.fillText`, `measureText`, `HTMLCanvasElement.toBlob(cb, "image/png")` | Devanagari values as images | [MDN fillText](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText), [MDN toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) |
| `URL.createObjectURL(blob)`, `URL.revokeObjectURL` | download link | [MDN createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) |

Versions and licences (`npm view`, 2026-11-15): `pdf-lib` 1.17.1 (MIT, last published 2022), `@pdf-lib/fontkit` 1.1.1 (MIT). Font: Noto Sans Devanagari from [notofonts/devanagari release NotoSansDevanagari-v2.007](https://github.com/notofonts/devanagari/releases/tag/NotoSansDevanagari-v2.007), SIL Open Font License 1.1 (GitHub licence API), self-hosted in `public/fonts/`.

### Known limitation: Devanagari shaping in pdf-lib

pdf-lib issue [#1409 "Space issue with embedded Hindi Font"](https://github.com/Hopding/pdf-lib/issues/1409) (open since 2023-02-28) reports gaps between characters when drawing Hindi with an embedded font; [#549](https://github.com/Hopding/pdf-lib/issues/549) reports the same; PR [#1775](https://github.com/Hopding/pdf-lib/pull/1775) proposed replacing fontkit with HarfBuzz for shaping and was closed unmerged. So `drawText` is **not** trusted for Devanagari. Design decision: any value containing a character outside WinAnsi (which includes all Devanagari) is drawn by the browser onto a canvas with Noto Sans Devanagari and embedded as a PNG. Task 7 compares this with fontkit `drawText` on a set of conjuncts and records the result; the canvas path stays the default unless fontkit output is visibly correct.

Trade-off: text drawn as an image is not selectable or searchable in the PDF. The PDF is meant for printing, so this is accepted and stated in README.

## Module layout

```
src/pdf/
  geometry.ts     toPdfRect(bbox, page) (pure)
  winansi.ts      canEncodeWinAnsi(text) using the Windows-1252 table (pure)
  fit.ts          fitText(text, boxW, boxH, measure) -> { size, lines } | "too-long" (pure)
  text-image.ts   renderTextPng(text, font, size, scale = 3) (DOM canvas)
  build.ts        buildPdf(input) -> PdfOutput
  index.ts
```

## Types

```ts
export type Background =
  | { kind: "clean" }                                   // redraw labels and boxes from the form model
  | { kind: "sample-pdf"; bytes: Uint8Array }           // original sample page underneath
  | { kind: "photo"; bytes: Uint8Array; mime: "image/png" | "image/jpeg" };

export interface PdfInput {
  form: FormModel;
  result: MappingResult;
  signatures: Map<string, Uint8Array>;   // PNG bytes by field ID
  background: Background;
  isSample: boolean;                     // adds the SAMPLE / DEMO DATA watermark
  printFlagged: boolean;                 // "print what I typed anyway"
}

export interface PdfOutput {
  bytes: Uint8Array;
  warnings: { fieldId: string; code: "text-too-long" | "flagged-printed" | "font-unavailable" }[];
}
```

## Geometry

For a page of `W x H` points and a box `{x, y, w, h}` in top-left fractions:
`rect = { x: x*W, y: H - (y + h)*H, width: w*W, height: h*H }`. Text baseline sits at `rect.y + (rect.height - textHeight) / 2`.

## Drawing rules

1. Background: `clean` draws each label (Helvetica, or the canvas path for Hindi labels) and a light rectangle per box; `sample-pdf` embeds page `i` with `embedPdf` and draws it at full size; `photo` draws the image scaled to the page.
2. `filled` text values: `fitText` tries 12 pt down to 7 pt, then two lines if the box allows; otherwise prints at 7 pt clipped to the box and returns a `text-too-long` warning (Req 2.3).
3. Non-WinAnsi values: canvas PNG at 3x the target size, drawn into the same rect (Req 3.1, 3.2).
4. `checkbox` `yes`: two `drawLine` strokes forming a tick inside the box. `choice`: the option text.
5. `signature`: the user's PNG fitted inside the box keeping aspect ratio. No signature is drawn without one (validation Req 4.3).
6. `photo` fields: left blank (Req 2.5).
7. `flagged` fields: nothing printed unless `printFlagged`; then the raw text is printed and a `flagged-printed` warning is listed (Req 4.2).
8. Samples: diagonal light-grey "SAMPLE / DEMO DATA" on every page, `setTitle("SAMPLE / DEMO DATA - <title>")` (Req 5.1). User forms: `setTitle(form.title)`, `setProducer("Stitchform")`; no answers in metadata (Req 5.3).

## Error handling

- Font or image fetch fails: message, clean background with Latin text only; Hindi values are listed as `font-unavailable` warnings so nothing is silently dropped.
- Any pdf-lib exception: caught in `buildPdf`, reported as "The PDF could not be made" with the field ID if known; values are never logged.

## Correctness properties

P1 to P5 are owned by field-mapping (P1, P4), validation (P2), stitch-code (P3) and llm-adapter (P5). Local properties (fast-check):

- Geometry: for any valid box and page size, `toPdfRect` stays inside `[0, W] x [0, H]` and its inverse returns the box (within 1e-9).
- `fitText` never returns a size above 12 or below 7, and the measured width of each returned line is at most the box width (injected measure function).
- `canEncodeWinAnsi` is false for any string containing a character in U+0900 to U+097F.

## Testing

- Unit tests run `buildPdf` in Node (pdf-lib works in Node) with a fake text-image function, then reload the bytes with `PDFDocument.load` and check page count, page size and title.
- The canvas path is checked by hand in Chrome and Firefox; screenshots of conjunct rendering go in `reports/raw/` and are referenced in KIRO_USAGE.md.
