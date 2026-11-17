# Tasks: Answering, typed by default with opt-in voice (F3)

Each task is one commit.

- [x] 1. Implement next-field selection in `ui/state.ts` with a property test, plus previous, skip and jump controls in the UI
  - _Requirements: 1.1, 1.3_

- [x] 2. Typed answer panel in lab-ui: one field at a time, type hint, free-text box, EN and HI labels
  - _Requirements: 1.2, 1.4, 1.5, 2.1, 2.3_

- [x] 3. Implement `support.ts` feature detection and hide the voice switch when unsupported
  - _Requirements: 4.1_

- [x] 4. Implement `consent.ts` and the voice notice dialog; confirm the Chrome wording in Chrome docs or fall back to "the browser vendor's speech service"
  - _Requirements: 3.1, 3.2_

- [x] 5. Implement `recogniser.ts` with interim and final results, tested with a fake `SpeechRecognition`
  - _Requirements: 2.2, 3.3, 3.4, 5.1, 5.2_

- [x] 6. On-device check and install flow with `available()` and `install()`, tested with stubs
  - _Requirements: 3.2, 4.2, 4.3_

- [x] 7. Error messages for every MDN error code, in EN and HI, returning to typed input
  - _Requirements: 4.4_

- [ ] 8. Manual voice check in Chrome for `en-IN` and `hi-IN` (on-device and cloud where available); record what worked in KIRO_USAGE.md
  - _Requirements: 3.2, 4.2_

2026-11-17: browser recognition is wrapped in `src/voice/index.ts`; consent and the bilingual notice live in the UI. The fake recogniser covers consent, local availability, cancellation before start, and stop. Physical microphone checks remain undone.

2026-11-17 follow-up: MDN error values map through `ui/voice-messages.ts` to bilingual recovery messages, with eleven unit cases including unknown/property-like values. A browser case proves consent precedes start and next-field navigation aborts a fake recogniser. This is not physical microphone validation.
