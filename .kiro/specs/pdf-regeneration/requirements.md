# Requirements: PDF regeneration (F6)

Feature F6 in PLAN.md section 5. Judging criterion: Technological Implementation.

## Introduction

The end product is a printable PDF that looks like the original form with the answers written in the right boxes. Stitchform builds it in the browser with pdf-lib. Hindi text needs special care because pdf-lib does not shape Devanagari correctly, so Hindi values are drawn by the browser and embedded as images.

## Glossary

- **Clean copy**: a PDF redrawn from the form model (labels and boxes), useful when the photo is crumpled.
- **Over original**: a PDF with the original sample page or the photo underneath the answers.
- **WinAnsi**: the character set of pdf-lib's built-in fonts (Windows-1252).

## Requirements

### Requirement 1: Layout matches the original

1.1 THE SYSTEM SHALL create one PDF page per form page with the page size from the form model.

1.2 THE SYSTEM SHALL place each value inside its field's box, converting the box from top-left page fractions to PDF coordinates.

1.3 WHEN the user picks "Clean copy" THE SYSTEM SHALL draw each field's label and a light box outline from the form model.

1.4 WHEN the user picks "Over original" THE SYSTEM SHALL draw the original sample PDF page, or the processed photo, scaled to the page, underneath the values.

### Requirement 2: Values by field type

2.1 THE SYSTEM SHALL draw `filled` text, number, date and choice values as text in the box.

2.2 THE SYSTEM SHALL shrink text from 12 pt down to 7 pt, and then wrap to two lines if the box is tall enough, to fit the box.

2.3 IF a value still does not fit THEN THE SYSTEM SHALL print it at 7 pt, clip it to the box and list a warning for that field before download.

2.4 THE SYSTEM SHALL draw a tick for a checkbox answered yes, and the user's own signature image fitted inside a signature box.

2.5 THE SYSTEM SHALL leave photo boxes blank.

### Requirement 3: Hindi and other non-Latin text

3.1 WHEN a value or label contains characters the built-in fonts cannot encode THE SYSTEM SHALL render it with the bundled Noto Sans Devanagari font on a canvas at three times the print size and embed it as a PNG image in the box.

3.2 THE SYSTEM SHALL self-host the font and SHALL NOT fetch it from a third-party server.

3.3 THE SYSTEM SHALL state in README that Hindi text in the PDF is an image and cannot be selected or searched.

### Requirement 4: Flagged fields

4.1 WHILE any required field is `flagged` THE SYSTEM SHALL show the list of issues before download and let the user fix them or continue.

4.2 WHEN the user continues with flagged fields THE SYSTEM SHALL leave those boxes empty unless the user chooses "print what I typed anyway", and SHALL list each such field in the warnings.

### Requirement 5: Labels, metadata and privacy

5.1 WHERE the form is one of the sample forms THE SYSTEM SHALL print "SAMPLE / DEMO DATA" across every page and put it in the PDF title.

5.2 THE SYSTEM SHALL build the PDF entirely in the browser and offer it as a download and a print view, without uploading it.

5.3 THE SYSTEM SHALL NOT put answers in the PDF metadata.
