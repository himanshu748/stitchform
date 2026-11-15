# Requirements: Three sample forms (F9)

Feature F9 in PLAN.md section 5. Judging criterion: Presentation.

## Introduction

Judges and first-time users need forms to try Stitchform on without using a real document. Stitchform ships three fictional forms that a script in the repository generates, so they are new work and can be rebuilt. Every file says "SAMPLE / DEMO DATA". None copies a real government form, logo, seal or ID format.

## Glossary

- **Sample**: one fictional form, produced as a PDF, a clean PNG, a "crumpled" PNG and a template JSON.
- **Template**: the exact field list of a sample (`FormModel`), used by capture-ocr to align a photo of the sample.
- **Demo person**: a fictional person whose example answers are used in the demo and video.

## Requirements

### Requirement 1: The three forms

1.1 THE SYSTEM SHALL provide a college admission form for "Lantern Hill College of Arts and Sciences (fictional)" with name, date of birth, guardian, address, course choice, previous marks, photo box and signature.

1.2 THE SYSTEM SHALL provide a scholarship application for "Moonfield Merit Scholarship Trust (fictional)" with name, date of birth, family income band (demo values), course of study, a short statement line, a declaration checkbox and signature.

1.3 THE SYSTEM SHALL provide a hostel admission form for "Hollowbrook Residential Hostel (fictional)" with name, date of birth, ID type (mock), address, emergency contact, date fields in mixed formats and signature.

1.4 THE SYSTEM SHALL print every label in English with a Hindi translation, and SHALL use "Sample ID number" for any ID field, never a real ID number format.

1.5 THE SYSTEM SHALL NOT include any real logo, seal, emblem, government form layout or real institution name.

### Requirement 2: Labelling

2.1 THE SYSTEM SHALL print "SAMPLE / DEMO DATA" in the header and as a watermark on every page of every sample PDF and image.

2.2 THE SYSTEM SHALL put "SAMPLE / DEMO DATA" in each sample PDF's title metadata, stored uncompressed so that commit-guard can find the bytes.

2.3 THE SYSTEM SHALL name sample images `sample-*.png` so that commit-guard's naming rule applies.

2.4 WHERE example answers are shown in the app, README or video THE SYSTEM SHALL use fictional demo people and label the answers as demo data.

### Requirement 3: Generation

3.1 THE SYSTEM SHALL generate all sample files with `npm run samples` (`scripts/make-samples.mjs`) from one template per form, so that the PDF, the images and the template JSON always agree.

3.2 THE SYSTEM SHALL write the outputs to `public/samples/` and commit them, so judges can download them without running the script.

3.3 THE SYSTEM SHALL produce a "crumpled" PNG of each form by rotating it slightly, adding perspective and adding noise and creases, with a fixed random seed so reruns give the same files.

3.4 WHEN the script runs twice with no template change THE SYSTEM SHALL produce byte-identical PDFs and templates.

### Requirement 4: Access in the app

4.1 THE SYSTEM SHALL offer the three samples on the start screen with a "Try a sample" button each, so a judge can reach a filled PDF without a camera, a microphone or an LLM.

4.2 THE SYSTEM SHALL offer each sample's printable PDF and crumpled PNG for download, so they can be printed and photographed.

### Requirement 5: Name check

5.1 THE SYSTEM SHALL use only institution names for which a web search, recorded with its date and result in README, found no real institution of that name.

5.2 IF a later search finds a real institution with one of the names THEN THE SYSTEM SHALL rename that sample and regenerate its files.
