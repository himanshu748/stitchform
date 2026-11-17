# Stitchform

Local submission copy for Kiroween 2026. Category: Frankenstein. Intended bonus: Best Student Project (Frankenstein), subject to the owner's eligibility details. Not submitted.

## Inspiration

A form asks for information in the document's order, language and format. Someone who knows the answers can still get stuck on where to write them, how to express a date or whether a signature is missing. Stitchform explores a quieter workflow: ask one question, let the person check the answer, then put it back on the paper. This is a product hypothesis, not a finding from a user study.

## What it does

Choose a fictional practice form or upload a photograph. Check the detected field boxes, answer by typing in English or Hindi, and review the result before downloading a printable PDF. Speaking is optional and starts behind a privacy notice. The app normalises supported dates and flags missing required fields and signatures.

The memorable moment is the second visit. Save an encrypted QR stitch code, reload the app, open the QR and enter its passphrase. The text answers return without an account or an answer-storage server. Signatures and images are deliberately excluded and must be added again.

## How we built it

The Frankenstein connection is the actual data path: browser camera or image upload → Tesseract OCR → editable field model → typed/optional spoken answers → deterministic mapping and validation → pdf-lib output → Web Crypto encryption → QR encoding and decoding.

Kiro produced the initial plan, EARS requirements, designs, tasks, steering, hook configuration and core mapping/validation/encryption work. Kiro CLI also ran a documented hook and Context7 smoke test. After Kiro reported its monthly limit, this thread continued with Codex for the document modules and interface. KIRO_USAGE.md separates those contributions and records which Kiro surfaces were actually exercised.

Modal and Ollama clients sit behind one optional adapter. Provider failures keep the deterministic result. The Modal server file is prepared and syntax-checked only; there is no live model or hosted-provider claim.

## Challenges

OCR needs a correction step. The generated crumpled samples are useful controlled inputs, but they do not establish performance on real damaged paper. Sample templates help the demo while generic labels and boxes remain heuristic.

Hindi PDF rendering needs a separate path. Browser-shaped text from the bundled Noto font is embedded as an image, preserving the visible text at the cost of search and selection.

Privacy also changes the interaction design. Voice can use a remote browser speech service; calling every feature local would be inaccurate. Typed input is the default, and voice/model paths require consent.

## Accomplishments

The local no-LLM journey reaches a downloadable PDF and restores text answers from a saved QR after reload. Tests cover invalid dates, missing signatures, same-origin sample requests, Hindi output, narrow layouts, field editing and reduced motion. Reports contain measured synthetic-image label recall and key-derivation timings, with their limits stated.

## What we learned

One property-based test found a validation idempotence problem: a choice label longer than 200 characters could be accepted from its short form and then rejected when validated again. The recorded fix lets valid printed option labels validate to themselves. This is a concrete example of why invariants help more than a few happy-path examples.

The seam experiment was smaller: the first visual pass lacked a reduced-motion rule. The corrected pass caps the effect and keeps status visible as text and a symbol. It was a Codex visual experiment, not a second Kiro usage claim.

## What's next

Test with consenting people who find forms difficult, measure real-photo field placement, verify actual microphone/camera behaviour, complete the remaining Kiro evidence, and validate any approved hosted provider. Publish only after the owner approves the repository and deployment. No adoption, accessibility certification or institutional endorsement is claimed.
