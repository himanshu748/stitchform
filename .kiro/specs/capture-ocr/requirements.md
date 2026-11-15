# Requirements: Form capture and OCR (F1)

Feature F1 in PLAN.md section 5. Judging criterion: Technological Implementation.

## Introduction

The user photographs a paper form (crumpled is fine) or uploads an image of it. Stitchform cleans the image up and reads it with Tesseract.js in a Web Worker, entirely in the browser, to find field labels and the boxes next to them. OCR language data and code are served from the app's own origin, so no third-party server sees the image or even the request. Detection is best on the three sample forms, whose layouts are known; on other forms it is best-effort, and the user can correct every field by hand.

## Glossary

- **Capture**: a photo from the camera or an uploaded image file.
- **Template**: the known field layout of a sample form, generated together with the sample.
- **Detected field**: a label and box found by OCR, before the user confirms it.

## Requirements

### Requirement 1: Camera and upload

1.1 WHEN the user chooses "Take a photo" THE SYSTEM SHALL ask for camera access with `getUserMedia`, show a live preview with a capture button, and stop every camera track as soon as the photo is taken or the user cancels.

1.2 IF camera access is denied, unavailable, or the page is not a secure context THEN THE SYSTEM SHALL explain this in one sentence and offer image upload instead.

1.3 WHEN the user uploads a PNG, JPEG or WebP image THE SYSTEM SHALL load it for OCR.

1.4 IF the user uploads a PDF or another file type THEN THE SYSTEM SHALL say that v1 accepts photos and images only, and point to the sample forms.

1.5 THE SYSTEM SHALL keep the captured image in memory only, and SHALL NOT upload, store or include it in a stitch code or LLM request.

### Requirement 2: Preprocessing

2.1 WHEN an image is loaded THE SYSTEM SHALL scale it so the long edge is between 1,600 and 2,400 pixels, convert it to greyscale and stretch its contrast before OCR.

2.2 THE SYSTEM SHALL ask Tesseract.js to correct small rotations automatically.

2.3 WHEN preprocessing finishes THE SYSTEM SHALL show the processed image so the user can retake the photo if it is unreadable.

### Requirement 3: OCR in the browser

3.1 THE SYSTEM SHALL run OCR in a Web Worker so the page stays responsive, and SHALL show progress.

3.2 THE SYSTEM SHALL recognise English and Hindi text in the same pass.

3.3 THE SYSTEM SHALL load the Tesseract.js worker script, WebAssembly core and `eng` and `hin` language data from the app's own origin, never from a CDN.

3.4 WHEN OCR finishes THE SYSTEM SHALL terminate the worker or keep a single worker for reuse, and SHALL never start more than one.

3.5 IF OCR fails or finds no words THEN THE SYSTEM SHALL say so and offer to retake the photo, pick a sample form, or add fields by hand.

### Requirement 4: Field detection

4.1 WHEN the OCR text contains the title of one of the three sample forms THE SYSTEM SHALL load that sample's template and align its field boxes to the photo using the positions of matched labels.

4.2 WHEN no sample is recognised THE SYSTEM SHALL propose fields from text lines that match a known label synonym or end with ":", placing each box in the blank area to the right of or below the label.

4.3 THE SYSTEM SHALL give each detected field a type from its label (for example a date type for "Date of Birth" or "जन्म तिथि", signature for "Signature" or "हस्ताक्षर") and mark it as not required unless the label carries "*" or the template says so.

4.4 THE SYSTEM SHALL express every box as fractions of the page size (field-mapping Req 1.2).

4.5 WHEN detection finishes THE SYSTEM SHALL show all detected fields over the image for the user to confirm or correct before answering starts.

### Requirement 5: Performance and honesty

5.1 THE SYSTEM SHALL download OCR language data only when OCR is first needed, not on page load.

5.2 THE SYSTEM SHALL state in the UI that detection works best on the sample forms and may miss fields on other forms.

5.3 THE SYSTEM SHALL measure OCR time and detection accuracy on the three "crumpled" sample images and report the measured numbers, and only those, in README and KIRO_USAGE.md.
