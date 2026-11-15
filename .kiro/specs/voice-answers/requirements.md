# Requirements: Answering, typed by default with opt-in voice in English and Hindi (F3)

Feature F3 in PLAN.md section 5. Judging criterion: Potential Impact.

## Introduction

People who find forms hard often find it easier to answer one question at a time, and some find speaking easier than writing. Stitchform asks for one field at a time, shows the label in English and Hindi, and lets the user type the answer (the default) or, after reading a notice, speak it. Browser speech recognition usually sends audio to the browser vendor's speech service, so voice is off until the user turns it on, and on-device recognition is offered where the browser supports it for the chosen language.

## Glossary

- **Prompt**: the current field, shown with its label, type hint and an example in the user's language.
- **On-device recognition**: speech recognition with `processLocally = true`, where neither audio nor transcript leaves the device.
- **Notice**: the one-time explanation shown before voice is first used.

## Requirements

### Requirement 1: Field-by-field prompting

1.1 WHEN answering starts THE SYSTEM SHALL prompt for the first unanswered field in form order, showing its label, whether it is required, and a short hint for its type (for example "Day/Month/Year" for dates).

1.2 WHEN the user submits an answer THE SYSTEM SHALL record it as an answer for that field, run mapping and validation for that field, show any issue next to it, and move to the next unanswered field.

1.3 THE SYSTEM SHALL let the user go back, skip a field, or jump to any field from a list.

1.4 WHEN the user switches the interface language between English and Hindi THE SYSTEM SHALL show labels, hints and messages in that language and set the voice language to `en-IN` or `hi-IN` to match.

1.5 THE SYSTEM SHALL let the user type a free-text answer that covers several fields, which goes to the mapper's free-text path (field-mapping Req 4).

### Requirement 2: Typed input is the default and always available

2.1 THE SYSTEM SHALL start with typed input and SHALL NOT request microphone access until the user turns voice on.

2.2 WHILE voice is on THE SYSTEM SHALL keep the text box visible and editable for every prompt, and SHALL put each recognised transcript into the text box for the user to check before submitting.

2.3 THE SYSTEM SHALL accept Devanagari and Latin script in the text box.

### Requirement 3: Voice notice and consent

3.1 WHEN the user first turns voice on THE SYSTEM SHALL show a notice saying that, unless on-device recognition is in use, the browser sends the audio to its speech service (in Chrome, a Google service) for recognition, and SHALL start recognition only after the user confirms.

3.2 WHERE on-device recognition is available for the chosen language THE SYSTEM SHALL say so in the notice and use it by default.

3.3 WHEN the user turns voice off THE SYSTEM SHALL stop recognition immediately and not restart it until the user turns it on again.

3.4 THE SYSTEM SHALL show a visible "listening" indicator whenever recognition is running.

### Requirement 4: Browser support

4.1 IF neither `SpeechRecognition` nor `webkitSpeechRecognition` exists THEN THE SYSTEM SHALL hide the voice switch and show one line saying voice is not supported in this browser.

4.2 WHERE `SpeechRecognition.available` exists THE SYSTEM SHALL check on-device availability for the chosen language with `processLocally: true` before each voice session.

4.3 WHEN on-device availability is `downloadable` THE SYSTEM SHALL offer to download the language pack with `SpeechRecognition.install`, and SHALL use cloud recognition only if the user declines and has confirmed the notice.

4.4 IF recognition fails with `not-allowed`, `service-not-allowed`, `audio-capture`, `network`, `language-not-supported` or `no-speech` THEN THE SYSTEM SHALL show a short message for that error and keep typed input ready.

### Requirement 5: Privacy

5.1 THE SYSTEM SHALL NOT record, store or upload audio itself; the only audio path is the browser's own recognition service.

5.2 THE SYSTEM SHALL NOT log transcripts.
