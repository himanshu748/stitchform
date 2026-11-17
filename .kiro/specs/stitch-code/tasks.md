# Tasks: QR stitch code (F7)

Each task is one commit. New npm dependencies go into README "Pre-existing work" in the same commit (commit-guard checks this).

- [x] 1. Add the byte format in `format.ts` with unit tests for encode/decode, magic, version and iteration bounds
  - _Requirements: 2.3, 2.4, 5.4_

- [x] 2. Add `compress.ts` (deflate-raw both ways, 64 KiB output cap) with unit tests
  - _Requirements: 3.3, 3.4_

- [x] 3. Add `crypto.ts`: PBKDF2-HMAC-SHA256 key derivation and AES-GCM seal/open with header as additional data
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Add `payload.ts` and `createStitchCode` / `openStitchCode`, with an example test that the header holds 600,000
  - _Requirements: 3.1, 3.2, 5.1, 5.2, 5.3_

- [x] 5. Property test P3: round-trip, wrong passphrase and single-byte tampering
  - `src/stitch-code/round-trip.property.test.ts`, `fc.asyncProperty`
  - _Requirements: 5.1, 5.2, 2.3, 3.4; Property: P3_

- [x] 6. Add the EFF large wordlist and the SecLists common-password list under `public/wordlists/`, with README attribution
  - _Requirements: 1.1, 1.4_

- [x] 7. Implement `generatePassphrase` (rejection sampling) and `checkCustomPassphrase` with unit tests
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8. Install `qrcode` and `jsqr` (exact versions), add README entries, implement `qr.ts` encode with the too-large path
  - _Requirements: 4.1, 4.2_

- [x] 9. Implement QR decoding from camera frames and uploaded images, and `.stitch` file open
  - _Requirements: 4.3, 4.4_

- [x] 10. Stitch-code panel UI (in lab-ui): passphrase dialog, progress during derivation, warnings
  - _Requirements: 2.5, 6.1, 6.2_

- [x] 11. Measure PBKDF2 time on a laptop and, if available, a low-end phone; record the numbers and devices in README and KIRO_USAGE.md (no estimates)
  - _Requirements: 2.5_

2026-11-17: QR image upload/refill is exercised in Playwright. Camera-frame decode and .stitch opening are implemented; physical camera scanning remains untested. PBKDF2 benchmark: five laptop runs recorded; low-end phone not available. A custom layout must be reopened before its text-only code can be applied.

2026-11-17 follow-up: Chromium tests download and reopen a `.stitch` file, reject a wrong passphrase, cancel unlocking before delayed native decryption finishes, and invalidate both pending encryption and displayed QR output when its passphrase changes.
