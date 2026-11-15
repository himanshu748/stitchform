# Requirements: Lab-stitching UI and privacy panel (F8)

Feature F8 in PLAN.md section 5. Judging criterion: Design.

## Introduction

Stitchform's look is a Frankenstein lab: the form is shown as a patchwork of field patches joined by seams, and each seam lights up as its field is filled. The theme stays restrained and readable, because the people it is for already find forms stressful. A privacy panel is always one click away and says plainly where data goes.

## Glossary

- **Patch**: the on-screen area of one field, drawn over the form image or the clean layout.
- **Seam**: the stitched outline of a patch. Its state shows the field status.
- **Privacy panel**: a panel with the privacy statement from PLAN.md section 1 and the current state of voice and LLM help.

## Requirements

### Requirement 1: Flow

1.1 THE SYSTEM SHALL guide the user through five steps shown in a step bar: Choose a form, Check fields, Answer, Review, Print and save.

1.2 WHEN the app opens THE SYSTEM SHALL offer "Try a sample", "Take a photo", "Upload an image" and "Open a stitch code" on the start screen.

1.3 THE SYSTEM SHALL let the user move back to any earlier step without losing answers.

1.4 WHEN the user reloads or closes the tab THE SYSTEM SHALL keep no answers, and SHALL warn before leaving if answers exist and no stitch code or PDF was made.

### Requirement 2: Seams show field status

2.1 THE SYSTEM SHALL draw a seam around each patch whose style reflects the field status: `empty` (dim dashed stitch), `filled` (lit stitch with a check mark) and `flagged` (amber stitch with a warning mark).

2.2 THE SYSTEM SHALL show status with a shape or icon and a text label in addition to colour.

2.3 WHEN a field changes to `filled` THE SYSTEM SHALL play a short "stitch lights up" animation of at most 600 ms on that seam only.

2.4 WHILE the user's system asks for reduced motion THE SYSTEM SHALL change the seam style without animation.

2.5 THE SYSTEM SHALL show a progress line, for example "7 of 10 required fields stitched".

### Requirement 3: Field editor

3.1 WHEN the user is on "Check fields" THE SYSTEM SHALL let them select a patch and edit its label, type, required flag and box with mouse, touch or keyboard (arrow keys move, Shift+arrow resizes).

3.2 THE SYSTEM SHALL let the user add and delete patches, with confirmation before deleting a patch that has a value.

### Requirement 4: Privacy panel and notices

4.1 THE SYSTEM SHALL show a "Privacy" button on every screen that opens the privacy panel.

4.2 THE SYSTEM SHALL show in the panel the privacy statement from PLAN.md section 1, and whether voice and LLM help are on, with the provider and endpoint host when LLM help is on.

4.3 WHILE voice or LLM help is on THE SYSTEM SHALL show a small persistent badge naming it ("Voice on: audio goes to the browser's speech service" or "LLM help on: <host>").

4.4 THE SYSTEM SHALL label every sample form and demo answer on screen as "SAMPLE / DEMO DATA".

### Requirement 5: Text and language

5.1 THE SYSTEM SHALL keep all UI text in one strings module per language (`src/ui/strings.en.ts`, `src/ui/strings.hi.ts`), with no text hard-coded in components.

5.2 THE SYSTEM SHALL contain no em dash (U+2014) in UI text.

5.3 WHEN the language is switched THE SYSTEM SHALL update all visible text without losing state.

### Requirement 6: Signature capture

6.1 WHEN the user reaches a signature field THE SYSTEM SHALL offer to draw a signature with mouse, touch or stylus, or upload an image of one, and SHALL keep it in memory only.

6.2 THE SYSTEM SHALL let the user clear and redo the signature.

### Requirement 7: Spec versus vibe comparison

7.1 WHEN the seam animation is first built THE SYSTEM SHALL get it from a one-line prompt with no spec ("vibe" coding), keep that version in its own commit, and then correct it against Requirement 2, so that KIRO_USAGE.md can compare the two honestly.
