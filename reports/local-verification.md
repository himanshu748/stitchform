# Local verification, 2026-11-17

This is a local prototype verification record. No public repository, hosting, model deployment, post, video upload or submission was performed.

| Boundary | Result | Evidence / limit |
|---|---|---|
| TypeScript | Passed | `npm run typecheck`, strict settings |
| Unit and property tests | Passed | `npm test`; P1 required coverage, P2 date round trips, P3 encrypted round trips/tamper rejection, P4 mapping idempotence, P5 safe LLM merges, plus PDF geometry/fitting/encoding and contrast/next-field properties |
| Production build | Passed | `npm run build`; static Vite output |
| Browser journey | Passed | Six Chromium cases in `e2e/smoke.spec.ts`: typed sample → validation/signature → PDF → encrypted QR → reload/refill; mobile/Hindi/keyboard/reduced motion; actual same-origin OCR; Hindi PDF; simulated model 503; delete confirmation |
| Network privacy default | Passed within tested path | Browser tests reject/record foreign-origin requests; all required assets are same-origin. Model 503 case is intercepted, not provider execution |
| Sample regeneration | Passed | Two regenerations produced byte-identical PDFs and templates |
| Synthetic OCR | Measured | `ocr-measurements.json`; label-text recall only, not box accuracy or real photographs |
| PBKDF2 | Measured | `pbkdf2-measurement.json`; five Chromium runs, laptop only |
| Hindi PDF | Inspected | Actual downloaded PDF rendered with Poppler; Hindi name visible in its intended field. Fontkit comparative script failed with missing regeneratorRuntime, so a successful side-by-side comparison is not claimed |
| Desktop/mobile design | Inspected | 1440px desktop; 390px screenshot and 320px browser reflow check. The mobile preview became collapsible after inspection |
| Keyboard/reduced motion | Targeted checks passed | Tab to sample, arrow move, Escape dialog close, native inputs, reduced-motion CSS. This does not establish a WCAG conformance audit |
| Modal Python | Syntax passed | `python3 -m py_compile modal/stitchform_llm.py`; no import/run/deploy or GPU execution |
| Repository guard | Passed before final commits | Manual invocation through Codex; Kiro hook coverage is separately recorded in KIRO_USAGE.md |
| Clean-copy quickstart | Passed | Clean `git archive` of 928fef5, `npm ci`, production build and all six browser cases passed. Later commit 594385f changes documentation and formatting only |
| Physical camera/microphone, VoiceOver, low-end phone, Firefox | Not tested | Needs actual device/screen-reader/language availability validation |
| Kiro form-qa / remaining hook and IDE runs | Not complete | Definitions and earlier smoke evidence exist; Kiro reported usage limit. Codex work is identified separately |
| Hosted app / live model / public CI | Not performed | Requires publication/deployment approval; CI configuration is committed but no remote CI run is claimed |

The saved OCR report is the source of truth: clean admission 8/8, scholarship 7/7, hostel 9/10; synthetic crumpled 7/8, 7/7, 10/10. Generic-form placement is heuristic. The UI requires checking the detected boxes and the final PDF.

Final local checks on 2026-11-17: 583 tests, including property tests, across 39 files (see final command output), six Chromium browser cases, strict TypeScript, Vite production build, sample PDF/template reproducibility and all-files guard. No public CI, deployment, live model or submission was run.
