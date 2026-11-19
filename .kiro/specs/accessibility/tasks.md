# Tasks: Accessibility (F10)

Each task is one commit.

- [x] 1. Check the exact wording of SC 1.4.10, 1.4.11, 2.4.7 and 2.5.8 in WCAG 2.2; implement `contrast.ts` with its property test
  - _Requirements: 1.1, 1.2_

- [x] 2. Define theme tokens and the token-pair contrast test
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Live-region `announce` helper and `lang` handling, used by every step
  - _Requirements: 3.2, 3.3_

- [x] 4. Keyboard support and focus handling for patches and dialogs
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

- [x] 5. Reduced motion, large-text mode, reflow at 320 px and touch target sizes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. QR alternative text and plain-language review of all strings in EN and HI
  - _Requirements: 3.4, 5.1, 5.2_

- [x] 7. Keyboard-only Playwright smoke path on a sample
  - _Requirements: 2.1_

- [ ] 8. Manual checks (VoiceOver, zoom, narrow viewport, reduced motion); record results and gaps in README
  - _Requirements: 6.1_

2026-11-17: implemented controls were checked with targeted Chromium tests (320px reflow, Hindi switch, keyboard movement, reduced motion, dialogs). No VoiceOver session or WCAG certification is claimed. Full live device coverage remains in the submission checklist.

2026-11-17 follow-up: `e2e/resilience.spec.ts` completes sample selection, typed answers, review and PDF download using only Tab, Enter, arrow keys and typing. It skips the photo/signature and checks the missing-signature warning. No pointer, locator focus or locator fill is used in this path. Manual screen-reader checks remain open.

2026-11-19: Codex reviewed both UI string modules, split dense notices into short paragraphs, clarified the QR alternative and passphrase-loss warning, and translated field types/new-field defaults. Three Chromium cases check those controls, bilingual QR names/privacy notices and 320px reflow. Rendered inspection found a squeezed language selector; mobile controls now wrap onto their own row. This is an editorial/automated review, not a comprehension study or VoiceOver session.
