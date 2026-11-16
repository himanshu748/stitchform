# Tasks: Validation (F5)

Each task is one commit. Run `npm run typecheck` and `npm test` before committing.

- [x] 1. Add `digits.ts` (Devanagari and ASCII digit conversion) with unit tests
  - _Requirements: 1.2, 3.2_

- [ ] 2. Add `issues.ts` with the `IssueCode` union and severities, plus EN and HI message files and a completeness test
  - _Requirements: 5.1, 5.2_

- [ ] 3. Implement `formatDate`, `isValidCalendarDate` and numeric `parseDate` with unit tests
  - Leap years, impossible dates, mixed separators rejected
  - _Requirements: 1.1, 1.4, 1.5, 1.7_

- [ ] 4. Property test P2: date round-trip for every numeric format and both digit sets
  - `src/validation/dates.property.test.ts`
  - _Requirements: 1.1, 1.2, 1.4, 1.8; Property: P2_

- [ ] 5. Add two-digit-year pivot and DOB plausibility with an explicit `today`
  - _Requirements: 1.6, 2.1, 2.2, 2.3_

- [ ] 6. Add English and Hindi month names, Hindi number words 0 to 99 and word-date parsing with unit tests
  - Examples: "5 March 2004", "March 5, 2004", "5 मार्च 2004", "पाँच मार्च दो हज़ार चार"
  - _Requirements: 1.3_

- [ ] 7. Implement `validateField` for text, number, choice, checkbox, signature and required checks
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

- [ ] 8. Property tests for validator idempotence and totality
  - _Requirements: 3.5, 5.3; supports Property: P1, P4, P5_

- [ ] 9. Re-validate on edit (wired in lab-ui; covered by the e2e smoke test)
  - _Requirements: 5.4_
