# Requirements: Accessibility (F10)

Feature F10 in PLAN.md section 5. Judging criterion: Design.

## Introduction

Stitchform is for people who struggle with forms, including people with low vision, limited literacy, motor difficulties or anxiety about paperwork. The web app targets WCAG 2.2 level AA. Where a criterion cannot be met (for example Hindi text in the generated PDF is an image), the gap is stated, not hidden.

## Glossary

- **Large-text mode**: an in-app switch that enlarges all text and controls.
- **Live region**: an element with `aria-live` whose changes screen readers announce.

## Requirements

### Requirement 1: Contrast and colour

1.1 THE SYSTEM SHALL give normal text a contrast ratio of at least 4.5:1 and large text at least 3:1 against its background (WCAG 2.2 SC 1.4.3).

1.2 THE SYSTEM SHALL give seams, focus outlines, icons and control borders a contrast ratio of at least 3:1 against adjacent colours (SC 1.4.11).

1.3 THE SYSTEM SHALL NOT use colour as the only way to show field status, errors or the current step (SC 1.4.1).

### Requirement 2: Keyboard

2.1 THE SYSTEM SHALL make every action available from the keyboard, in a logical tab order, with no keyboard trap (SC 2.1.1, 2.1.2).

2.2 THE SYSTEM SHALL show a visible focus indicator on every focusable element (SC 2.4.7).

2.3 WHEN a dialog opens THE SYSTEM SHALL move focus into it, and WHEN it closes THE SYSTEM SHALL return focus to the control that opened it.

2.4 THE SYSTEM SHALL let the user move and resize field boxes with the keyboard (lab-ui Req 3.1).

### Requirement 3: Screen readers

3.1 THE SYSTEM SHALL give every input a programmatic label, and every patch an accessible name made of its label and status (for example "Date of birth, needs a fix").

3.2 WHEN an issue appears, OCR or key derivation progress changes, or an LLM request falls back THE SYSTEM SHALL announce it through a polite live region.

3.3 THE SYSTEM SHALL mark Hindi text with `lang="hi"` and English text with `lang="en"` so screen readers use the right voice.

3.4 THE SYSTEM SHALL give the QR stitch code image a text alternative that says what it is and that it holds encrypted answers.

### Requirement 4: Motion and text size

4.1 WHILE the system setting asks for reduced motion THE SYSTEM SHALL turn off all non-essential animation, including the seam animation.

4.2 THE SYSTEM SHALL keep content and functions usable when browser text is enlarged to 200% (SC 1.4.4) and when the viewport is 320 CSS pixels wide (SC 1.4.10).

4.3 WHEN the user turns on large-text mode THE SYSTEM SHALL enlarge text and controls to at least 125% of the default and keep that setting in memory for the session.

4.4 THE SYSTEM SHALL make touch targets at least 24 by 24 CSS pixels (SC 2.5.8).

### Requirement 5: Plain language and time

5.1 THE SYSTEM SHALL write prompts, issues and notices in plain language of at most two short sentences.

5.2 THE SYSTEM SHALL NOT impose time limits on the user, apart from the 20-second LLM request timeout, which falls back without losing work.

### Requirement 6: Honest reporting

6.1 THE SYSTEM SHALL document in README the accessibility checks that were done (tool or manual, browser, date) and every known gap, including that Hindi text in the generated PDF is an image of text.
