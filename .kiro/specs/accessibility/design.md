# Design: Accessibility (F10)

Requirements: [requirements.md](requirements.md). Applies to all of `src/ui` (lab-ui design).

## Standards and APIs (confirmed 2026-11-15)

| Item | Facts used | Source |
|---|---|---|
| WCAG 2.2 | SC 1.4.3 contrast at least 4.5:1, large text 3:1; SC 1.4.1 use of colour; SC 1.4.4 resize text to 200%; SC 1.4.5 images of text (AA) | [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Contrast ratio formula | `(L1 + 0.05) / (L2 + 0.05)` with relative luminance from sRGB | [WCAG 2.2 definitions: contrast ratio, relative luminance](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio) |
| `prefers-reduced-motion` | reduced-motion media query | [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) |
| `aria-live="polite"` | announcements | [MDN aria-live](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live) |
| `lang` attribute | per-element language | [MDN lang](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang) |
| `<dialog>` `showModal()` | modal focus handling by the browser | [MDN dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) |

SC 1.4.10 (reflow, 320 CSS px), 1.4.11 (non-text contrast 3:1), 2.4.7 (focus visible) and 2.5.8 (target size 24 x 24) are AA criteria in the same WCAG 2.2 document; their exact wording is checked against the document in task 1 before the test thresholds are coded.

## Approach

- `src/ui/theme.css` defines colour tokens. `src/ui/contrast.ts` (pure) implements the WCAG relative luminance and contrast ratio, and a unit test asserts every text/background and seam/background token pair against Req 1.1 and 1.2. This turns the contrast rule into a check that runs on every commit.
- Status is always icon + text + colour (Req 1.3), shared with lab-ui's seam table.
- Native elements first: `<button>`, `<label for>`, `<input>`, `<dialog>`. Patches in the SVG are focusable `<g role="button" tabindex="0" aria-label="...">` with arrow-key handling.
- One `aria-live="polite"` region per screen, written by a small `announce(text)` helper.
- Language: the root `lang` follows the UI language; mixed EN/HI labels wrap the other script in `<span lang="...">`.
- Large-text mode sets a class on `<html>` that raises the root font size to 125% or 150%; all sizes are in `rem`.
- Layout uses flexible CSS (no fixed widths above 320 px) so reflow holds.

## Known gap

Hindi values in the generated PDF are images of text (pdf-regeneration design, pdf-lib issue #1409). SC 1.4.5 is about web content; the PDF is a print artefact, but the gap is still listed in README (Req 6.1).

## Error handling

Errors are announced through the live region and shown next to the related control, with focus moved to the first field that needs a fix when the user presses "Review".

## Correctness properties

P1 to P5 are owned by field-mapping (P1, P4), validation (P2), stitch-code (P3) and llm-adapter (P5). Local property (fast-check): `contrastRatio(a, b)` is symmetric, lies between 1 and 21, and equals 21 for black on white.

## Testing

- Unit: `contrast.ts` property and the token-pair test.
- Playwright smoke test: completes the typed path on a sample using only the keyboard.
- Manual: VoiceOver on macOS Safari and Chrome, 200% zoom, 320 px viewport, reduced motion on. Results with date and browser go in README; no automated accessibility scanner is added unless it is confirmed and listed in "Pre-existing work".
