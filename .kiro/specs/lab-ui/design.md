# Design: Lab-stitching UI and privacy panel (F8)

Requirements: [requirements.md](requirements.md). Uses every other module through its `index.ts`.

## External APIs (confirmed 2026-11-15)

| API | Used for | Source |
|---|---|---|
| SVG `<rect>` with `stroke-dasharray`, `stroke-dashoffset` | seams | [MDN stroke-dasharray](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dasharray), [MDN stroke-dashoffset](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset) |
| CSS transitions and `@media (prefers-reduced-motion: reduce)` | seam animation and its reduced-motion variant | [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) |
| `<dialog>` with `showModal()` | notices and confirmations | [MDN dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) |
| `beforeunload` event | warn before leaving with unsaved answers | [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) |
| Pointer events on `<canvas>`; `canvas.toBlob(cb, "image/png")` | signature pad | [MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [MDN toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) |

No UI framework: plain TypeScript and DOM, so nothing new goes into "Pre-existing work" for the UI. Rendering uses `textContent` and `createElement` only, never `innerHTML` with data, so OCR text, answers and LLM notes cannot inject markup.

## Module layout

```
src/ui/
  app.ts             step state machine and top-level render
  state.ts           AppState (in memory only) and pure reducers
  steps/choose.ts, steps/check-fields.ts, steps/answer.ts, steps/review.ts, steps/print-save.ts
  patchwork.ts       SVG patches and seams over the form image or clean layout
  field-editor.ts    select, move, resize (mouse, touch, keyboard)
  privacy-panel.ts   statement, live status of voice and LLM
  badges.ts          persistent "Voice on" / "LLM help on" badges
  signature-pad.ts
  strings.en.ts, strings.hi.ts, strings.ts (typed lookup, both files must have the same keys)
  theme.css          tokens: colours, spacing, seam styles
```

## State

```ts
type Step = "choose" | "check-fields" | "answer" | "review" | "print-save";
interface AppState {
  step: Step;
  lang: "en" | "hi";
  form?: FormModel;
  answers: Answer[];
  signatures: Map<string, Uint8Array>;
  result?: MappingResult;
  voice: VoiceMode;
  llm: ProviderConfig;            // { id: "none" } by default
  savedSinceLastChange: boolean;  // stitch code or PDF made
  largeText: boolean;
}
```

Reducers in `state.ts` are pure and unit tested. Nothing in `AppState` is written to storage (Req 1.4); only the optional remembered LLM key is, through the llm-adapter key store.

## Seams

Each patch is an SVG `rect` with a dashed stroke. Status classes:

| Status | Stroke | Mark | Text label |
|---|---|---|---|
| `empty` | dim thread colour, dashed | none | "Not answered" |
| `filled` | lit thread colour, dashed | check mark | "Stitched" |
| `flagged` | amber, dashed with wider gaps | warning triangle | "Needs a fix" |

Animation (Req 2.3): on change to `filled`, a CSS transition on `stroke-dashoffset` and stroke colour runs for 500 ms. Under `prefers-reduced-motion: reduce` the transition is `none` (Req 2.4). Colour pairs are chosen in the accessibility spec to meet contrast.

## Privacy panel text

The statement is the block quote in PLAN.md section 1, stored in the strings files. The Chrome-specific sentence is used only after voice-answers task 4 confirms it; until then it reads "the browser vendor's speech service".

## Error handling

Each step shows module errors as one plain sentence in an `aria-live="polite"` region (accessibility spec) and keeps the user's data. No error path clears answers.

## Correctness properties

P1 to P5 are owned by field-mapping (P1, P4), validation (P2), stitch-code (P3) and llm-adapter (P5). The UI relies on them; the UI's own checks are example tests:

- Reducer tests: going back keeps answers (Req 1.3); language switch keeps state (Req 5.3).
- `strings.en.ts` and `strings.hi.ts` have identical keys and contain no U+2014 (Req 5.1, 5.2; commit-guard also checks UI string files).

## Testing

- Vitest with `happy-dom` or `jsdom` is not installed; DOM-heavy code is covered by the Playwright smoke test (typed, no-LLM path on a sample) instead of adding a DOM test dependency.
- Manual review by the form-qa custom agent against this spec and the accessibility spec.
