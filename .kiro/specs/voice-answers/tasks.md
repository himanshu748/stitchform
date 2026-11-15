# Tasks: Answering, typed by default with opt-in voice (F3)

Each task is one commit.

- [ ] 1. Implement `prompter.ts` (next, previous, skip, jump) with unit tests and the `nextField` property test
  - _Requirements: 1.1, 1.3_

- [ ] 2. Typed answer panel in lab-ui: one field at a time, type hint, free-text box, EN and HI labels
  - _Requirements: 1.2, 1.4, 1.5, 2.1, 2.3_

- [ ] 3. Implement `support.ts` feature detection and hide the voice switch when unsupported
  - _Requirements: 4.1_

- [ ] 4. Implement `consent.ts` and the voice notice dialog; confirm the Chrome wording in Chrome docs or fall back to "the browser vendor's speech service"
  - _Requirements: 3.1, 3.2_

- [ ] 5. Implement `recogniser.ts` with interim and final results, tested with a fake `SpeechRecognition`
  - _Requirements: 2.2, 3.3, 3.4, 5.1, 5.2_

- [ ] 6. On-device check and install flow with `available()` and `install()`, tested with stubs
  - _Requirements: 3.2, 4.2, 4.3_

- [ ] 7. Error messages for every MDN error code, in EN and HI, returning to typed input
  - _Requirements: 4.4_

- [ ] 8. Manual voice check in Chrome for `en-IN` and `hi-IN` (on-device and cloud where available); record what worked in KIRO_USAGE.md
  - _Requirements: 3.2, 4.2_
