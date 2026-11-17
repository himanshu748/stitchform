# Stitchform: stitching a paper form back together in the browser

DRAFT. This post is being written as part of the Kiroween 2026 hackathon. It has not been published. The owner should edit the voice and personal opinions before publication.

A form can be awkward even when someone knows every answer. The document determines the order, the language and the expected date format. Stitchform explores whether a person can answer one question at a time, check the result and print a filled copy without creating an account.

The Frankenstein idea is literal in the data flow. A photograph becomes browser OCR. OCR becomes a set of editable field boxes. Typed or optional spoken answers pass through deterministic mapping and validation. pdf-lib draws the result onto the paper layout. Web Crypto encrypts text answers into a QR code for another visit.

## What Kiro contributed

The initial build used Kiro CLI through T3 Code. Its plan became eleven specs, each with EARS requirements, a design and a task list. Four steering files separate product decisions, technical boundaries, structure and answer-handling privacy. The repository also contains tests-on-save, documentation-sync and commit-guard hooks, plus a read-only form-qa custom agent and Context7 MCP configuration.

The useful distinction is between a file and evidence. A recorded Kiro smoke run observed SessionStart, PostFileSave and a PreToolUse guard that blocked a push attempt. Some other triggers were replayed or remain unobserved; KIRO_USAGE.md says which. The custom agent is configured but its final review is pending. After Kiro reported its monthly usage limit, the build continued with Codex. That work is recorded separately instead of counted as Kiro execution.

## An invariant that found a real bug

Property-based testing checked that a normalised answer should validate again. A long choice option exposed a mismatch: a short input could match a printed option longer than 200 characters, but validating the resulting full label rejected it. The fix accepts valid option labels at their actual length. This is more useful evidence than saying that tests made the app reliable in general.

## The privacy promise had to shape the product

Typed input is the default. Browser voice recognition may send audio to its speech service, so it requires a notice. The optional LLM sends labels and answer text only, behind one adapter; the default flow does not need a model. The prepared Modal file has never been deployed or GPU-tested.

The stitch code stores encrypted text answers. It excludes images, signatures, credentials and the passphrase itself. A second visit can restore a built-in sample's answers by opening the QR and entering the passphrase. An arbitrary edited layout is not stored in the code. That is a limit, not a hidden server dependency.

## What the local build demonstrates

A browser test completes the typed journey, downloads the PDF and restores the QR after reload. Other checks cover Hindi text, a narrow viewport, reduced motion and real OCR of generated samples using same-origin assets. Synthetic crumpled images provide controlled experiments; they are not evidence of accuracy on physical damaged paper. Hindi PDF values are rendered as images and cannot be searched or selected.

The next work needs real people and real devices: consent-based usability checks, actual microphone/camera validation, physical-photo measurements, remaining Kiro evidence and an approved release. No user adoption or measured social impact is claimed.

TODO before publication: add the approved public repository and app URLs, choose real screenshots, and revise this draft in the owner's own voice. Do not publish it until explicitly approved.
