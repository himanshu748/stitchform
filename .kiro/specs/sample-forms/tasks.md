# Tasks: Three sample forms (F9)

Each task is one commit. Generated files are committed together with the script change that produced them.

- [x] 1. Web-search the three institution names; record date and result in README; rename any that exist
  - _Requirements: 1.5, 5.1, 5.2_

- [x] 2. Write the three templates in `scripts/samples/templates/` with EN and HI labels and validate them in a Vitest test
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Write `scripts/make-samples.mjs` PDF output with pdf-lib (header, watermark, uncompressed title, fixed dates) and copy templates to `public/samples/`
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.4_

- [x] 4. Add the Playwright-rendered clean and crumpled PNGs (seeded noise), and Hindi label images for the PDFs
  - _Requirements: 2.1, 2.3, 3.3_

- [x] 5. Add `demo-answers.json` with fictional demo people, labelled DEMO DATA
  - _Requirements: 2.4_

- [x] 6. "Try a sample" buttons and downloads on the start screen (in lab-ui)
  - _Requirements: 4.1, 4.2_

- [ ] 7. Run the form-qa custom agent on `public/samples/` and fix any finding; record the run in KIRO_USAGE.md
  - _Requirements: 1.5, 2.1, 2.2_
