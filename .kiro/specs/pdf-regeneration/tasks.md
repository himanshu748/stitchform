# Tasks: PDF regeneration (F6)

Each task is one commit. New dependencies and the font go into README "Pre-existing work" in the same commit.

- [x] 1. Implement `geometry.ts` with the round-trip and in-page property test
  - _Requirements: 1.2_

- [x] 2. Implement `winansi.ts` (Windows-1252 table) with unit tests and the Devanagari property
  - _Requirements: 3.1_

- [x] 3. Implement `fit.ts` with an injected measure function and its property test
  - _Requirements: 2.2, 2.3_

- [x] 4. Install `pdf-lib@1.17.1` and `@pdf-lib/fontkit@1.1.1`; add Noto Sans Devanagari (v2.007, OFL) to `public/fonts/` with its licence file; README entries
  - _Requirements: 3.2_

- [x] 5. Implement `buildPdf` for the clean background with Latin text, checkboxes, signatures and metadata; Node tests reload the output with `PDFDocument.load`
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.4, 2.5, 5.1, 5.3_

- [x] 6. Add the sample-PDF and photo backgrounds
  - _Requirements: 1.4_

- [x] 7. Implement `text-image.ts` (canvas path) and compare it with fontkit `drawText` on Hindi conjuncts; record screenshots and the decision in KIRO_USAGE.md
  - _Requirements: 3.1, 3.3_

- [x] 8. Pre-download issue list, "print anyway" option and warnings in lab-ui; download and print view
  - _Requirements: 4.1, 4.2, 5.2_

2026-11-19: `scripts/compare-hindi-pdf.mjs` generated the six-phrase comparison under `output/pdf/`; Poppler output was inspected. Both columns were readable for these phrases. The app retains its specified canvas path; broader shaping/extraction/viewer coverage is not established. The report in `reports/hindi-rendering-comparison.md` records the compatibility-runtime preload, reproduction, observed result and limits. No new runtime package or application renderer change was introduced.
