# Design: Gestalt UI revamp

## 20 November revision

Owner feedback called for a functional application layout. The entry now combines import controls and a compact practice-form list with a live preview of the real sample. The workspace uses a document viewer and a task pane with a shared step bar. Cool slate and blue distinguish work surface from active controls. DM Sans serves all Latin interface text and Noto Sans Devanagari serves Hindi. The decorative hero and its display font were retired. Proximity, similarity, continuity and figure-ground continue to guide the working layout. The design and browser evidence are recorded in `reports/ui-revamp.md`.

The user requested a UI revamp using Gestalt techniques. This is a visual/interaction extension of lab-ui and accessibility, not a change to form-processing contracts. Primary judging mapping: Design; supporting Presentation and Potential Impact through a clearer judge/user journey. No usability improvement is claimed as measured.

## Direction and references

Character: a calm, contemporary paperwork studio with warm paper surfaces, forest ink, pale chartreuse thread, original form imagery and restrained stitching details. Entry leads directly to the existing five-step lab; it is not a separate marketing site.

Inspected in the browser on 2026-11-19:

- [GOV.UK question-page pattern](https://design-system.service.gov.uk/patterns/question-pages/): explicit question hierarchy, labels close to controls, restrained navigation and a distinct forward action. The inspected viewport included its embedded question example and surrounding pattern navigation.
- [Tally entry screen](https://tally.so/): large plain-language headline, adjacent supporting copy/primary action, and whitespace separating the invitation from the product example. No wording, illustrations, metrics, branding or code are reused.

These are qualitative observations, not measured source typography or spacing. All colours, dimensions, illustrations and composition choices here are original to Stitchform.

## Gestalt application

| Principle | Decision |
|---|---|
| Proximity | Keep input, help, error and Save together; place file format help beside upload |
| Common region | Contain starting actions, the active question, PDF output and stitch-code output in distinct surfaces |
| Similarity | Repeat sample-card anatomy, field state chips, button hierarchy and control styles |
| Continuity | Join numbered steps with a seam; use consistent alignment from page title to input to forward action |
| Figure-ground | Give the active task a white surface against a muted document workbench |
| Closure | Use a few purposeful seam fragments in the original paper illustration rather than outlining every region |

## Typography and motion

Fraunces variable font provides warm, compact display headings/wordmark; DM Sans variable font handles readable body text, controls and labels. Existing Noto Sans Devanagari remains the Hindi fallback and PDF canvas font. New fonts are downloaded from the official Google Fonts repository, self-hosted with OFL licences, and recorded in README. Check loaded fonts and realistic EN/HI text in the browser.

Follow the motion-design skill and its context-adaptation guidance: calm intent; 120ms hover/press feedback and a short 220ms task entrance, limited to opacity/transform. Existing filled-field seam feedback remains below 600ms. No ambient loop, bounce, parallax or motion-dependent information. Reduced motion disables the effects.

## Implementation and acceptance

Keep the current DOM application and pure state/processing modules. Restructure presentation groups in `src/ui/app.ts`, add bilingual keys, replace the accumulated theme stylesheet with coherent tokens/layout rules, and retain semantic controls and stable accessible action names. No UI framework or icon package is required. Font assets and original decorative SVG/CSS are the only new visual resources.

Exercise the real sample-to-PDF-to-code path, existing cancellation/consent tests, keyboard-only path, 320px Hindi layout and reduced motion. Inspect the rendered entry and every workspace step. Document observations and remaining physical-device/VoiceOver limits honestly. These files are Codex-authored specs; no additional Kiro execution is implied.
