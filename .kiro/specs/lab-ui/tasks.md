# Tasks: Lab-stitching UI and privacy panel (F8)

Each task is one commit.

- [x] 1. Add `strings.en.ts`, `strings.hi.ts` and the typed lookup with a key-parity and no-em-dash test
  - _Requirements: 5.1, 5.2_

- [x] 2. Add `state.ts` reducers and the step bar with unit tests for back navigation and language switch
  - _Requirements: 1.1, 1.3, 5.3_

- [x] 3. Start screen with sample, photo, upload and stitch-code entries; leave warning
  - _Requirements: 1.2, 1.4_

- [ ] 4. Vibe pass: build the seam animation from a one-line prompt with no spec; commit as is and note what it got wrong
  - _Requirements: 7.1_

- [x] 5. Spec pass: rebuild `patchwork.ts` seams against Requirement 2 (status shapes and labels, 600 ms cap, reduced motion, progress line); record the comparison in KIRO_USAGE.md
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1_

- [x] 6. Field editor with mouse, touch and keyboard
  - _Requirements: 3.1, 3.2_

- [x] 7. Privacy panel and persistent badges
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Signature pad (draw, upload, clear) kept in memory
  - _Requirements: 6.1, 6.2_

- [x] 9. Wire answer, review and print-and-save steps to voice-answers, validation, pdf-regeneration and stitch-code
  - _Requirements: 1.1, 2.5_

2026-11-17: implementation uses one DOM composition file (`src/ui/app.ts`) with separate pure state, strings, DOM helpers and CSS, rather than one file per step. Task 4 stays unchecked: the brief visual pass existed but had the already-written spec available, so it is not a true spec-free experiment. Keyboard field movement and narrow/reduced-motion states are automated. VoiceOver is untested.

2026-11-17: implemented controls were checked with targeted Chromium tests (320px reflow, Hindi switch, keyboard movement, reduced motion, dialogs). No VoiceOver session or WCAG certification is claimed. Full live device coverage remains in the submission checklist.
