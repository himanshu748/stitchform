# Gestalt UI revamp, 2026-11-19

The owner requested a visual revamp using Gestalt techniques. This local implementation covers the entry page and all five form steps. It preserves form processing, privacy/consent, the no-LLM path and output formats. No publication, deployment or submission was performed.

## Design decisions

| Principle | Implemented decision |
|---|---|
| Proximity and common region | Upload/camera actions and format help share one starting panel; the field label, hint, input, issues and next action share a question card |
| Continuity | A seam connects the five numbered steps; the current step has a distinct capsule and retains its complete accessible name on small screens |
| Similarity | Sample cards, inputs, field-state chips and forward actions repeat the same anatomy |
| Figure-ground | A muted document workbench sits beside a white task surface; PDF and encrypted-code exports have separate regions |
| Closure | Partial seam lines and overlapping original paper shapes suggest stitching without outlining every part of the page |

The browser-inspected references were [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/) and [Tally's entry page](https://tally.so/). Observations: explicit question/action hierarchy in GOV.UK; headline/copy/action proximity and separated product imagery in Tally. These were qualitative references, not measured source styles. No assets, statistics, testimonials, wording, branding or code were copied.

Fraunces handles display headings/wordmark; DM Sans handles controls and body text. Existing Noto Sans Devanagari handles Hindi fallback. The new layout uses the established forest/cream palette with pale thread accents and original decorative SVG/CSS. Motion is limited to short task transitions and field feedback, disabled under reduced motion. The motion-design skill and its context-adaptation guidance informed this restraint.

## Actual verification

- Chromium 159.0.8154.6, local app: rendered entry, check, answer, review and save screens inspected at desktop size; English mobile at 390px and Hindi at 320px also inspected. Fonts were reported loaded and computed styles used the intended families.
- The first 320px/200% CSS text-size simulation exposed an intrinsic grid-width overflow on the entry illustration. `minmax(0, 1fr)`, bounded decorative elements and a scalable language control corrected it. The final inspection manifest records no horizontal overflow. This is a text-enlargement simulation, not a physical phone or native browser zoom audit.
- Visual review exposed stale paper-field status after an answer validated. The new regression first failed (`dob` remained `flagged` after valid input). Recalculation now refreshes only the paired document/progress, preserving the input and focus. The regression and the full browser suite passed afterwards.
- The original 18 Chromium cases pass: sample/typed/validation/signature/PDF/code-refill, actual same-origin OCR, Hindi output, keyboard-only flow, reduced motion, consent with a fake recogniser, cancellations and error paths.
- `npm test`: 596 unit/property tests across 41 files passed. The production build/strict TypeScript ran through the browser suite's web-server entry point.
- The shared preview initially worked, then two snapshot calls timed out with `Preview automation snapshot timed out after 15000ms.` The skill's CLI wrapper returned `playwright-cli: command not found`. Remaining captures used the already-installed Playwright engine directly, with no package installation or new test framework.
- Inspection source and machine-readable observations: [script](../output/playwright/inspect-revamp.mjs), [manifest](../output/playwright/revamp-inspection.json). No console page errors were recorded in that inspection.

The screenshots contain fictional sample forms and demo answers. They do not establish usability improvements, WCAG certification, physical camera/microphone behaviour, VoiceOver operation, Firefox support or live-provider success.

## Screens

- [Entry before](../output/playwright/revamp-before-home.png) / [entry after](../output/playwright/revamp-home-desktop.png)
- [Check fields](../output/playwright/revamp-check-desktop.png)
- [Answer](../output/playwright/revamp-answer-desktop.png)
- [Review](../output/playwright/revamp-review-desktop.png)
- [Print and save](../output/playwright/revamp-save-desktop.png)
- [Mobile answer](../output/playwright/revamp-answer-mobile.png) / [Hindi at 320px](../output/playwright/revamp-answer-hindi-320.png)
- [Inline visual review](../output/playwright/revamp-review.html)

## Font provenance

Both files are variable TrueType fonts from the official `google/fonts` repository, downloaded unchanged on 2026-11-19 with the accompanying OFL licences. No new npm dependency was added.

Internal versions were read with installed fontTools 4.60.2 (MIT), used only as local inspection tooling. Licence-file line endings/trailing spaces were normalised for Git; font bytes were not modified. The staged text changes passed the known-pattern secret scan with no findings; generated screenshots and fonts were checked through visual inspection/provenance rather than a credential-pattern scan. The repository guard passed across 259 tracked files.

| File | Internal version | SHA-256 |
|---|---|---|
| `DMSans[opsz,wght].ttf` | 4.004; gftools 0.9.30 | `8cd08d97e89c24d0aa92edd2f0f4c8ee6195eee9b7c9f154865a58b02f0c1c0d` |
| `Fraunces[SOFT,WONK,opsz,wght].ttf` | 1.000; b76b70a41 | `177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb` |

Context7 resolved `/mdn/content` and returned MDN examples confirming variable `@font-face` weight ranges, SVG namespace creation and decorative `aria-hidden` treatment. Those docs informed the font declarations and dependency-free icon helper. This was Codex/docs-MCP work, not a Kiro agent execution.
