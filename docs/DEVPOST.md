# Stitchform judge and submission guide

**Kiroween 2026 category:** Frankenstein. See the [official rules](https://kiroween.devpost.com/rules) and [draft project story](../DEVPOST_STORY.md).

Stitchform helps someone turn a paper form into a printable PDF. On-device OCR locates the form fields, editable boxes let the user correct detection, and deterministic validation checks answers before export. An optional encrypted QR carries text answers for a later visit. The browser can complete this journey without an account or model key.

## Try the demo

1. Choose **Try the scholarship sample** on the landing page, or upload the [bundled fictional sample image](../public/samples/sample-moonfield-scholarship.png) to run the browser OCR path.
2. Inspect the editable fields and continue to answers. Enter a fictional name and an impossible date such as `31/02/2004`. Correct it to `5 March 2004` and verify that the review shows `05/03/2004`.
3. Continue to print and save, then choose **Make and download PDF**. Look for the fictional name and normalized date in the exported page.
4. Make a stitch code using a demo-only passphrase. Download its QR, reload, open the QR and enter the passphrase. Confirm the two text answers returned. Signatures and images are excluded from the stitch code.

The tested path uses synthetic forms and typed answers. Voice input can use the browser's speech service after consent. Model assistance is optional and disabled by default. The Modal service file has been syntax-checked locally and has no verified hosted endpoint.

## Main technology requirement

Kiro CLI over ACP in T3 Code produced the initial plan and foundation. The committed [OCR requirements](../.kiro/specs/capture-ocr/requirements.md), [stitch-code design](../.kiro/specs/stitch-code/design.md) and [privacy steering](../.kiro/steering/form-privacy-and-i18n.md) show how specific requirements became staged implementation and review tasks.

A separate real Kiro CLI 3.3.0 smoke run observed SessionStart, PostFileSave and PreToolUse. The [commit-guard hook](../.kiro/hooks/commit-guard.json) blocked a dry-run publication command. Context7 resolved the pdf-lib documentation in the same run. The read-only [form-qa agent definition](../.kiro/agents/form-qa.json) validated, and its final review attempt stopped at Kiro's monthly request limit. Later implementation and browser verification used Codex.

The [validation property tests](../src/validation/validators.property.test.ts) caught an idempotence issue where a selected printed answer could validate from its short form and then fail when validated again. [KIRO_USAGE.md](../KIRO_USAGE.md) separates observed runs, validated configuration and manually replayed hooks.

## Devpost fields

| Field | Evidence or value |
| --- | --- |
| Category | Frankenstein |
| Source | [Public GitHub repository](https://github.com/himanshu748/stitchform) with MIT license and root `.kiro/` |
| Working application | Enter the public URL after a signed-out run of the hosted sample. The repository includes the **Publish browser demo** workflow. |
| Demonstration video | Enter the verified public YouTube URL. The event recommends a video under three minutes. |
| Testing instructions | Use the four-step no-account workflow above. |
| Reuse | [Pre-existing work and licenses](../README.md#pre-existing-work) |
| Eligibility and survey responses | Entrant completes the personal fields and any optional bonus declarations. |
