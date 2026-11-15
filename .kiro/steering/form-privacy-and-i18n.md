---
inclusion: fileMatch
fileMatchPattern: ["src/mapping/**", "src/validation/**", "src/voice/**", "src/stitch-code/**", "src/llm/**"]
---

# Form data, privacy and Indian-language input

This file loads when you work on code that touches a user's answers. Those answers are personal data (names, dates of birth, addresses, ID numbers). Treat them that way.

## Data handling

- Answers never leave the browser except through the two opt-in paths below. No analytics, no error reporting service, no third-party CDN requests that include answers.
- Never log answers, passphrases, API keys or decrypted stitch-code contents. `console.*` calls in these modules may log field IDs and issue codes only.
- Do not persist answers to `localStorage`, `IndexedDB` or cookies. The stitch code is the only way answers survive a reload, and it is encrypted.
- Stitch codes never include LLM API keys or the form image.

## Opt-in paths and their notices

- **Voice:** WHEN the user first enables voice THE SYSTEM SHALL show a notice that, unless on-device recognition is in use, audio is sent to the browser's speech service, and SHALL start recognition only after the user confirms. Typed input stays available at every step. Offer on-device recognition (`processLocally`) only when `SpeechRecognition.available()` reports it for the language. Hide voice when `SpeechRecognition` is unsupported.
- **LLM help:** off by default. Before the first request, show which provider receives field labels and answers. Send labels and answers only, never the image. Keys stay in memory unless the user ticks "remember this key on this device", which shows a warning and a "forget key" button.
- If either path fails, fall back silently to typed input or rule-based mapping and show a short, plain message.

## Languages

- UI and voice support English (`en-IN`) and Hindi (`hi-IN`).
- Label synonyms come in both scripts, for example "Date of Birth", "DOB", "जन्म तिथि". Keep synonym lists in data files, not scattered through code.
- Accept Devanagari digits (०१२३४५६७८९) anywhere digits are accepted and normalise them to ASCII digits internally. Show values back in the script the user typed.

## Dates on Indian forms

- The canonical display format is DD/MM/YYYY. Also accept D/M/YYYY, DD-MM-YYYY, DD.MM.YYYY, D-M-YY, YYYY-MM-DD and spoken forms such as "5 March 2004" or "पाँच मार्च दो हज़ार चार".
- Two-digit years are ambiguous. Resolve them with an explicit, documented pivot and flag the field so the user confirms.
- Reject impossible dates (31/02) with a clear issue message. Never silently "correct" a date.
- Property P2: for every supported format, `parse(format(d))` equals `d` for any valid date, including Devanagari digits.

## Required fields and signatures

- Property P1: after mapping, every required field is either filled with a value that passes its validator or carries an issue. Nothing required is silently empty.
- A signature field is "present" only when the user has drawn or uploaded one. Never generate a signature.

## Sample and demo data

- Only the three fictional sample forms in `public/samples/` and fictional people. Every sample file carries "SAMPLE / DEMO DATA".
- Never use real government forms, logos, seals or real ID number formats (use "Sample ID number").
