# Tasks: Field model and rule-based mapping (F2)

Each task is one commit. Run `npm run typecheck` and `npm test` before committing.

- [x] 1. Add the shared types in `src/form-model/types.ts` and `index.ts` exports
  - `FieldType`, `BBox`, `FormField`, `PageInfo`, `FormModel`, `Answer`, `Issue`, `FieldResult`, `MappingResult` exactly as in design.md
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 2. Implement `validateFormModel`, `addField` and `updateField` with unit tests
  - Duplicate IDs, out-of-range boxes, bad page index, empty choices are rejected
  - _Requirements: 1.3, 2.1, 2.2_

- [x] 3. Add the form-model arbitrary in `src/mapping/arbitraries.ts`
  - Valid forms with 1 to 20 fields of every type; used by P1, P4 and P5
  - _Requirements: 1.1, 1.3_

- [x] 4. Write `normaliseLabel` and the EN and HI synonym data files with unit tests
  - NFC, case folding, whitespace collapse, trailing ":" and "*" removed
  - Synonyms cover every label on the three sample forms
  - _Requirements: 4.2, 4.5_

- [x] 5. Implement `segment` for free-text answers with unit tests
  - Ambiguous segments go to `unmatched`
  - _Requirements: 4.1, 4.3_

- [x] 6. Implement `mapAnswers` (depends on validation task 7, `validateField`)
  - Prompted answers, latest wins, prompted beats free text, required, signature and photo rules
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.4, 5.2, 5.3, 5.4, 5.5, 6.3, 7.1, 7.2_

- [x] 7. Property test P1: required fields are filled or flagged
  - `src/mapping/map-answers.property.test.ts`
  - _Requirements: 5.1, 5.2, 5.4; Property: P1_

- [x] 8. Implement `toPromptedAnswers` and property test P4: mapping idempotence
  - _Requirements: 6.1, 6.2; Property: P4_

- [x] 9. Manual-correction UI hooks (wired in lab-ui): confirm before deleting a field with a value
  - _Requirements: 2.1, 2.3_
