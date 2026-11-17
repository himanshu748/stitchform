---
inclusion: always
---

# Product: Stitchform

Stitchform turns a photo or scan of a paper form (crumpled is fine) into a correctly filled, printable PDF. It is a Kiroween 2026 entry in the Frankenstein category, planned for the Best Student Project (Frankenstein) bonus, subject to eligibility and submission.

## Who it is for

People who struggle with forms: first-generation college applicants, people more comfortable speaking than writing, people filling forms in a second language, older adults, people with low vision or limited literacy, and the helpers who fill forms for them.

## Core flow

1. Capture: camera photo or image upload (PNG, JPEG or WebP; PDF upload is outside v1).
2. OCR in the browser (Tesseract.js) finds field labels and boxes.
3. Answer each field by typing (default) or, after opting in, by voice in English or Hindi.
4. Rule-based mapping and validation place answers and catch mistakes (dates, required fields, signature). An optional LLM can help but is never required.
5. pdf-lib redraws the form with the answers in place, ready to print.
6. A QR "stitch code" holds the answers encrypted with a passphrase so a second visit refills the form.

## Privacy stance (non-negotiable)

- No backend. No server stores answers.
- Every step runs in the browser by default.
- Only two opt-in features may send data off the device, each behind a notice the user confirms first:
  - Voice input: browser speech recognition may send audio to the browser vendor's speech service unless on-device recognition is available and in use.
  - LLM help: field labels and answers (never the form image) go to the provider the user picks.
- The UI and README must state this plainly.

## Honesty rules

- Never fabricate users, statistics, testimonials or results. If a number is not measured, say so.
- All demo data is labelled "SAMPLE / DEMO DATA". Sample institutions are fictional and carry "(fictional)" in their name.
- Never use real government forms, real logos, seals or real ID formats.

## What "done" means for a feature

- Its spec in `.kiro/specs/<name>/` has EARS requirements, a design and tasks, and every task is checked off.
- Unit tests and the relevant property tests pass (`npm test`), `npm run typecheck` and `npm run build` pass.
- README and KIRO_USAGE.md reflect any change in behaviour or Kiro configuration.

## Judging criteria (each 20%)

Potential Impact, Technological Implementation, Design, Innovation/Idea, Presentation. PLAN.md section 5 maps every feature to one criterion. Keep that mapping in mind when choosing what to polish.

## Writing style for UI and docs

- Plain, short sentences. No em dashes (U+2014) anywhere in docs or UI text.
- No hype. Describe things at their real size.
