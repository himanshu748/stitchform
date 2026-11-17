# Tasks: Form capture and OCR (F1)

Each task is one commit. New dependencies and downloaded data go into README "Pre-existing work" in the same commit.

- [ ] 1. Implement pure pixel helpers (`greyscale`, `stretchContrast`) with unit tests
  - _Requirements: 2.1_

- [ ] 2. Implement `preprocess.ts` (scale to 1,600 to 2,400 px long edge) and `upload.ts` with file-type checks
  - _Requirements: 1.3, 1.4, 2.1, 2.3_

- [ ] 3. Implement `camera.ts` with track cleanup and every documented error path
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 4. Install `tesseract.js@7.0.0`, add `scripts/copy-ocr-assets.mjs` (worker, 4 core files, `eng` and `hin` data), commit the assets, add README entries
  - _Requirements: 3.3, 5.1_

- [ ] 5. Implement `worker.ts` (single lazy worker, `rotateAuto`, `blocks` output, progress logger) and `words.ts` with a box-range property test
  - _Requirements: 2.2, 3.1, 3.2, 3.4, 4.4_

- [ ] 6. Implement `detect-sample.ts` (title match, least-squares alignment) with unit tests (depends on sample-forms task 3 templates)
  - _Requirements: 4.1, 4.4_

- [ ] 7. Implement `detect-generic.ts` and type inference from synonyms with unit tests
  - _Requirements: 4.2, 4.3_

- [ ] 8. Add `npm run test:ocr` integration test on the three sample PNGs
  - _Requirements: 3.2, 4.1_

- [ ] 9. Wire capture and detection into the lab-ui flow with the "works best on samples" note and the failure messages
  - _Requirements: 3.5, 4.5, 5.2_

- [ ] 10. Measure OCR time and field-detection results on the three crumpled samples; record the numbers and the machine used
  - _Requirements: 5.3_
