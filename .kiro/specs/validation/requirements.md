# Requirements: Validation (F5)

Feature F5 in PLAN.md section 5. Judging criterion: Potential Impact.

## Introduction

Forms get rejected for small mistakes: a date in the wrong format, an empty required box, a missing signature. Validation catches these before printing and explains them in plain English or Hindi. It runs entirely in the browser, and the same validators gate every value, whether typed, spoken, read from a stitch code or suggested by an LLM.

## Glossary

- **Validator**: a pure function that takes a field and a raw string and returns either a normalised value or a list of issues.
- **Canonical date**: a date shown as DD/MM/YYYY with ASCII digits.
- **Pivot year**: the documented rule that turns a two-digit year into a four-digit year.

## Requirements

### Requirement 1: Date parsing and normalisation

**User story:** As a user who writes dates in different ways, I want Stitchform to understand my date and print it in the format the form expects.

#### Acceptance criteria

1.1 WHEN a `date` field receives text in DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY, D-M-YY or YYYY-MM-DD THE SYSTEM SHALL parse it as day, month and year in that order.

1.2 WHEN the text contains Devanagari digits (०१२३४५६७८९) THE SYSTEM SHALL treat them as the ASCII digits 0 to 9.

1.3 WHEN the text is a spoken or written date such as "5 March 2004", "March 5, 2004", "5 मार्च 2004" or "पाँच मार्च दो हज़ार चार" THE SYSTEM SHALL parse the day, the English or Hindi month name and the year, including Hindi number words for days 1 to 31 and years written as "उन्नीस सौ <1 to 99>" or "दो हज़ार <0 to 99>".

1.4 WHEN a date is valid THE SYSTEM SHALL normalise it to the canonical DD/MM/YYYY form, and parsing a canonical value SHALL return the same date.

1.5 IF the day, month and year do not form a real calendar date (for example 31/02/2004 or 29/02/2003) THEN THE SYSTEM SHALL return issue `date-impossible` with severity `error`.

1.6 IF the year has two digits THEN THE SYSTEM SHALL resolve it with the pivot rule (for a DOB, the latest year ending in those digits that is not in the future; otherwise 2000 to 2099) and add issue `date-two-digit-year` with severity `warning` so the user confirms.

1.7 THE SYSTEM SHALL NOT change a date the user gave into a different date; if text cannot be parsed it SHALL return issue `date-unparsed` with severity `error`.

1.8 THE SYSTEM SHALL provide `formatDate(date, format)` for every supported numeric format, and for any valid date `d` in years 1900 to 2099 and any supported format `f`, `parseDate(formatDate(d, f))` SHALL equal `d`, also when the digits are Devanagari.

### Requirement 2: Date of birth plausibility

2.1 IF a field marked as a date of birth has a date after today THEN THE SYSTEM SHALL return issue `dob-in-future` with severity `error`.

2.2 IF a date of birth gives an age above 120 years THEN THE SYSTEM SHALL return issue `dob-implausible` with severity `warning`.

2.3 THE SYSTEM SHALL take "today" as an explicit input to the validator so that results are reproducible in tests.

### Requirement 3: Other field types

3.1 WHEN a `text` field is validated THE SYSTEM SHALL trim surrounding whitespace, collapse inner runs of spaces, apply NFC normalisation, and treat an empty result as no answer.

3.2 WHEN a `number` field is validated THE SYSTEM SHALL accept ASCII or Devanagari digits with optional spaces and normalise to ASCII digits; IF other characters remain THEN THE SYSTEM SHALL return issue `number-invalid`.

3.3 WHEN a `choice` field is validated THE SYSTEM SHALL accept an option label or a listed synonym in English or Hindi and normalise to the option label; IF nothing matches THEN THE SYSTEM SHALL return issue `choice-unknown` listing the options.

3.4 WHEN a `checkbox` field is validated THE SYSTEM SHALL accept yes or no words in English and Hindi ("yes", "no", "हाँ", "नहीं") and normalise to `yes` or `no`.

3.5 THE SYSTEM SHALL make every validator idempotent: validating a normalised value SHALL return the same value with no new error.

### Requirement 4: Required fields and signatures

4.1 WHEN a required field has no answer after normalisation THE SYSTEM SHALL return issue `required-missing` with severity `error`.

4.2 IF a required `signature` field has no drawn or uploaded image THEN THE SYSTEM SHALL return issue `signature-missing` with severity `error`.

4.3 THE SYSTEM SHALL NOT create, draw or suggest a signature on the user's behalf.

### Requirement 5: Issues and messages

**User story:** As a user who finds forms confusing, I want each problem explained in short, plain words in my language, next to the field.

#### Acceptance criteria

5.1 THE SYSTEM SHALL describe each issue with a field ID, an issue code, a severity and optional parameters, and SHALL NOT put the answer value into the issue.

5.2 THE SYSTEM SHALL provide an English and a Hindi message for every issue code, in plain language of at most two short sentences.

5.3 THE SYSTEM SHALL make validators total: for any string input they SHALL return a result and never throw.

5.4 WHEN the user changes the answer to a flagged field THE SYSTEM SHALL re-validate that field immediately.
