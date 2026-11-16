# Requirements: Field model and rule-based mapping (F2)

Feature F2 in PLAN.md section 5. Judging criterion: Technological Implementation.

## Introduction

Every other module talks about a form through one shared field model. The rule-based mapper turns the user's answers into field values without any network access, so Stitchform works fully with LLM help off. The mapper never guesses silently: a required field is either filled with a value that passes its validator, or it carries an issue the user can see.

## Glossary

- **Form model**: the list of fields of one form, with label, type, required flag, box and page.
- **Answer**: one thing the user said or typed, either in reply to a prompt for a specific field or as free text.
- **Mapping result**: for every field, its status (`filled`, `flagged` or `empty`), its value if any, and its issues.
- **Label synonym**: another way of writing a field label, in English or Hindi (for example "DOB", "जन्म तिथि").

## Requirements

### Requirement 1: Shared field model

**User story:** As a developer of any Stitchform module, I want one field schema, so that OCR, mapping, validation, PDF and stitch code agree on what a field is.

#### Acceptance criteria

1.1 THE SYSTEM SHALL represent each field with `id`, `label`, `type`, `required`, `bbox` and `page`, where `type` is one of `text`, `date`, `number`, `choice`, `checkbox`, `signature` or `photo`.

1.2 THE SYSTEM SHALL store `bbox` as fractions of the page width and height (0 to 1, origin at the top-left of the page), so that the same field can be drawn on a photo, a canvas or a PDF page of any size.

1.3 WHEN a form model is created or edited THE SYSTEM SHALL reject it if two fields share an `id`, if a `bbox` lies outside 0 to 1, if `page` is not a page of the form, or if a `choice` field has no options.

1.4 THE SYSTEM SHALL keep the form model free of personal data: answers live in the mapping result, never in the form model.

### Requirement 2: Manual correction of fields

**User story:** As a user whose photo was read imperfectly, I want to fix a field's label, type, required flag or box, so that the filled PDF lands in the right place.

#### Acceptance criteria

2.1 WHEN the user moves or resizes a field box, renames a label, changes a type or toggles required THE SYSTEM SHALL update the form model and re-run mapping and validation for the affected field.

2.2 WHEN the user adds a field THE SYSTEM SHALL give it a new unique `id` and default it to `type` `text` and `required` false.

2.3 WHEN the user deletes a field that has a value THE SYSTEM SHALL ask for confirmation before removing it.

### Requirement 3: Direct answers to prompted fields

**User story:** As a user answering one field at a time, I want my answer to go into the field I was asked about.

#### Acceptance criteria

3.1 WHEN an answer carries the `id` of the field it was prompted for THE SYSTEM SHALL map it to that field.

3.2 WHEN the answer's normalised value passes the field's validator THE SYSTEM SHALL set the field status to `filled` with the normalised value.

3.3 IF the answer's value fails the field's validator THEN THE SYSTEM SHALL set the field status to `flagged`, keep the raw text so the user can edit it, and attach the validator's issues.

3.4 WHEN the user answers the same field more than once THE SYSTEM SHALL use the latest answer.

### Requirement 4: Free-text answers matched by label synonyms

**User story:** As a user who says several things at once ("my name is Asha Verma, date of birth 5 March 2004"), I want each part to land in the right field.

#### Acceptance criteria

4.1 WHEN an answer has no prompted field THE SYSTEM SHALL split it into label and value segments using the English and Hindi label synonym lists and match each segment to at most one field.

4.2 THE SYSTEM SHALL compare labels after Unicode NFC normalisation, case folding, collapsing whitespace and removing trailing punctuation such as ":" and "*".

4.3 IF a segment matches more than one field equally well THEN THE SYSTEM SHALL leave it unmatched and list it in `unmatched` so the user can place it by hand.

4.4 WHERE a matched segment is for a field that already has a prompted answer THE SYSTEM SHALL keep the prompted answer and add a warning issue to the field instead of overwriting it.

4.5 THE SYSTEM SHALL keep synonym lists in data files under `src/mapping/`, not in mapping code.

### Requirement 5: Required fields are never silently empty

**User story:** As a user printing a form, I want to know about every required field I have not answered, so that the institution does not reject my form.

#### Acceptance criteria

5.1 WHEN mapping finishes THE SYSTEM SHALL give every required field either status `filled` with a value that passes its validator, or status `flagged` with at least one issue of severity `error`.

5.2 IF a required field has no answer THEN THE SYSTEM SHALL flag it with issue code `required-missing`.

5.3 WHEN a field is not required and has no answer THE SYSTEM SHALL set its status to `empty` with no error issue.

5.4 IF a field of type `signature` has no drawn or uploaded signature THEN THE SYSTEM SHALL flag it with issue code `signature-missing` when required, and never generate a signature.

5.5 IF a field of type `photo` is present THEN THE SYSTEM SHALL leave it unfilled and add an `info` issue telling the user to paste a photo after printing.

### Requirement 6: Deterministic and idempotent mapping

**User story:** As a user who reloads a stitch code or edits one answer, I want the same answers to always give the same filled form.

#### Acceptance criteria

6.1 THE SYSTEM SHALL produce the same mapping result for the same form model and the same answers, with no dependency on time, randomness or network.

6.2 WHEN the mapping result is turned back into prompted answers and mapped again THE SYSTEM SHALL give every field the same status, value, raw text and provenance with no new issue, and turning that second result into prompted answers SHALL give the same answers. Only warnings about how an answer was written (such as `date-two-digit-year`, once the value is in canonical form) and `free-text-ignored` (free text is not carried over) may drop out.

6.3 THE SYSTEM SHALL run the rule-based mapper without any network request.

### Requirement 7: Privacy inside the mapper

7.1 THE SYSTEM SHALL NOT log answer values; log lines from the mapper may contain field IDs and issue codes only.

7.2 THE SYSTEM SHALL NOT write answers to `localStorage`, `IndexedDB` or cookies.
