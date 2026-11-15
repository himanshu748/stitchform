# Design: Three sample forms (F9)

Requirements: [requirements.md](requirements.md). Templates are `FormModel` objects (field-mapping design) with `source: "sample"`.

## External APIs (confirmed 2026-11-15)

| API | Used for | Source |
|---|---|---|
| pdf-lib `PDFDocument.create`, `addPage([595.28, 841.89])`, `drawText`, `drawRectangle`, `drawLine`, `embedFont`, `registerFontkit`, `setTitle`, `setCreationDate`, `setModificationDate`, `save({ useObjectStreams: false })` | sample PDFs. `useObjectStreams: false` writes classic objects, so the Info dictionary title bytes stay readable for commit-guard. Fixed creation and modification dates make output reproducible (Req 3.4). | [pdf-lib README](https://github.com/Hopding/pdf-lib#readme), `PDFDocument.save` source via Context7 `/hopding/pdf-lib` |
| Playwright `chromium.launch()`, `page.setViewportSize`, `page.setContent(html)`, `page.screenshot({ path })` | PNG images: the script renders an HTML version of the same template in headless Chromium (so Hindi labels are shaped by the browser) and takes a screenshot | [Playwright screenshots](https://playwright.dev/docs/screenshots), [Page API](https://playwright.dev/docs/api/class-page), Context7 `/microsoft/playwright/v1.64.1` |
| CSS `transform` (rotate, perspective) and an SVG `feTurbulence` filter | the "crumpled" look in the same headless page | [MDN transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform), [MDN feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence) |

Using Playwright (already a dev dependency) for the images avoids adding a Node canvas library. It needs `npx playwright install chromium` once, which README states. Hindi labels in the PDF follow the pdf-regeneration rule: drawn as images, here taken from Playwright element screenshots, because pdf-lib does not shape Devanagari (pdf-regeneration design, pdf-lib issue #1409). The `seed` for `feTurbulence` makes the noise reproducible.

A4 is 595.28 x 841.89 points (210 x 297 mm at 72 points per inch).

## Files

```
scripts/make-samples.mjs          entry point for npm run samples
scripts/samples/templates/*.json  one FormModel per sample, hand-written (the single source of truth)
scripts/samples/render-html.mjs   template -> HTML page (labels EN + HI, boxes, header, watermark)
public/samples/
  sample-lantern-hill-admission.pdf | .png | -crumpled.png | .template.json
  sample-moonfield-scholarship.pdf  | .png | -crumpled.png | .template.json
  sample-hollowbrook-hostel.pdf     | .png | -crumpled.png | .template.json
  demo-answers.json                 fictional demo people, labelled DEMO DATA
```

PDF names also start with `sample-`; all images are `sample-*.png` (Req 2.3).

## Template content

Each template lists its fields with `id`, EN `label`, HI label in a parallel `labelsHi` map, `type`, `required`, `bbox` (page fractions) and `page`. Example field IDs for the hostel form: `full-name`, `dob` (`dateRole: "dob"`), `id-type` (choice: "Sample ID card", "Sample student card", "Sample other document"), `sample-id-number`, `address`, `emergency-contact-name`, `emergency-contact-phone`, `arrival-date`, `departure-date`, `signature`. The hostel form prints different date hints on its date fields (DD/MM/YYYY, YYYY-MM-DD, D-M-YY) so the validator's formats are exercised (Req 1.3).

Income bands on the scholarship form are labelled "Band A (demo)", "Band B (demo)", "Band C (demo)" with no real currency thresholds (Req 1.2).

## Demo people

`demo-answers.json` holds two fictional people per form, with names built from common words and a "DEMO DATA" flag on every record. They are used by the e2e smoke test and the video script. No real person's data is used (Req 2.4).

## Error handling

The script exits non-zero with a clear message if Chromium is not installed (`npx playwright install chromium`), if a template fails `validateFormModel`, or if any output lacks the "SAMPLE / DEMO DATA" bytes (a self-check matching commit-guard's rule).

## Correctness properties

P1 to P5 are owned by field-mapping (P1, P4), validation (P2), stitch-code (P3) and llm-adapter (P5). The sample templates are used as fixed inputs in example tests of P1 (every required sample field is flagged when empty) and of capture-ocr alignment.

## Testing

- `npm run samples` twice, then `git diff --exit-code public/samples/*.pdf public/samples/*.template.json` (Req 3.4). PNG files may differ by antialiasing between Chromium versions, so only PDFs and templates are checked for byte equality.
- A Vitest test loads each template and runs `validateFormModel`.
- form-qa custom agent review of the three PDFs for labelling, fictional names and absence of real ID formats.
