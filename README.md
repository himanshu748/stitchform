<img src="assets/icon.svg" width="64" height="64" alt="">

# Stitchform

Stitchform turns a photo or scan of a paper form (crumpled is fine) into a correctly filled, printable PDF, in your browser.

It is being built for the [Kiroween 2026 hackathon](https://kiroween.devpost.com/) (Frankenstein category) with [Kiro](https://kiro.dev/). It is a work in progress: this README describes what exists today and marks planned parts as planned.

**Working app URL:** TBD after deployment (Vercel).

## What it does

Stitchform stitches together technologies that do not normally meet:

1. **Capture** a camera photo or upload an image (PNG, JPEG or WebP) of a form. PDF upload is not in v1. (planned)
2. **OCR** in the browser with Tesseract.js finds the field labels and boxes. (planned)
3. **Answer** each field by typing (the default) or, after you opt in, by voice in English or Hindi. (planned)
4. **Map and check** answers with rule-based logic that catches date-format mistakes, missing required fields and missing signatures. An optional LLM can help; the app works fully with it off. (planned)
5. **Regenerate** a printable PDF with pdf-lib that matches the original layout. (planned)
6. **Stitch code**: a QR code holds your answers, encrypted with a passphrase, so a second visit refills the form instantly. (planned)

## Who it is for

People who struggle with forms: first-generation college applicants, people more comfortable speaking than writing, people filling forms in a second language, older adults, people with low vision or limited literacy, and the helpers who fill forms for them.

## Privacy

Stitchform has no backend and no server stores your answers. By default, every step runs in your browser: OCR, typed answers, mapping, checks, PDF generation and stitch-code encryption. Two optional features can send data off your device, and each stays off until you turn it on after reading a notice:

- **Voice input.** By default, browser speech recognition sends your audio to a speech service run by the browser vendor, as described in [MDN: Using the Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API). Where your browser supports on-device recognition for your language, Stitchform offers it and says so.
- **LLM help.** Field labels and your answers (never the form image) are sent to the provider you pick. The preselected provider is a Modal endpoint that the person running Stitchform deploys from `modal/` (an open-weights model served by vLLM); the alternatives are Ollama on your own machine and, only if its browser access is confirmed, the Gemini free tier. With LLM help off, nothing is sent.

Apart from these, the only network requests download the app itself and the OCR language data.

## Sample forms

Stitchform will ship three sample forms it generates itself, all for fictional institutions and all marked "SAMPLE / DEMO DATA": Lantern Hill College of Arts and Sciences (fictional) admission form, Moonfield Merit Scholarship Trust (fictional) application, and Hollowbrook Residential Hostel (fictional) admission form. No real government forms, logos or ID formats are used. (planned)

## How to run

Requirements: Node.js 22.12 or newer and npm.

```sh
npm install
npm run dev        # local dev server
npm run build      # typecheck, then build static files into dist/
npm run preview    # serve dist/ on http://localhost:4173
```

## How to test

```sh
npm run typecheck              # TypeScript strict mode, no emit
npm test                       # Vitest unit and fast-check property tests
FC_NUM_RUNS=1000 npm test      # more property-test runs
npx playwright install chromium
npm run test:e2e               # Playwright smoke test (added with the typed, no-LLM flow)
npm run guard                  # the commit-guard repository checks on every tracked file
```

## Built with Kiro

The `/.kiro` folder is committed on purpose: steering files, agent hooks, custom agents, MCP configuration and specs. See [KIRO_USAGE.md](KIRO_USAGE.md) for how each was used.

- `.kiro/steering/`: `product.md`, `tech.md`, `structure.md` (always included) and `form-privacy-and-i18n.md` (included when working on answer-handling code).
- `.kiro/hooks/`: `test-on-save` (related Vitest tests on save), `doc-sync` (updates README and KIRO_USAGE.md after each spec task), `commit-guard` (blocks bad commits and any publish or deploy command), `hook-smoke` (logs which hooks fired).
- `.kiro/agents/form-qa.json`: a read-only reviewer for privacy, accessibility, demo-data labelling and spec conformance.
- `.kiro/specs/`: one spec per feature (`requirements.md` in EARS notation, `design.md`, `tasks.md`): `capture-ocr`, `field-mapping`, `voice-answers`, `llm-adapter`, `validation`, `pdf-regeneration`, `stitch-code`, `lab-ui`, `sample-forms`, `accessibility`, `deliverable-docs`.
- `.kiro/settings/mcp.json`: the [Context7](https://github.com/upstash/context7) docs MCP server.

The commit-guard hook only sees commits that the Kiro agent makes through its shell tool. Commits made by hand skip it; the CI workflow in `.github/workflows/ci.yml` runs the same checks after you push.

### Optional Context7 API key

Context7 works without a key at a lower rate limit. To use a free key, add a header to `.kiro/settings/mcp.json` that reads it from your environment, never a literal key: `"headers": { "Authorization": "Bearer ${CONTEXT7_API_KEY}" }`, then approve `CONTEXT7_API_KEY` when Kiro asks.

## Pre-existing work

Everything in this repository was written during the Kiroween 2026 submission period except the items below.

From the initial commit created by [T3 Code](https://t3.codes):

- The placeholder `README.md` text ("Created in T3 Code"), now replaced.
- `assets/icon.svg`, still used as the project icon above.

Third-party npm packages (development only; none are bundled into the app yet):

| Package | Version | Licence | Used for |
|---|---|---|---|
| `vite` | 8.3.8 | MIT | dev server and static build |
| `typescript` | 7.0.2 | Apache-2.0 | type checking |
| `vitest` | 5.1.0 | MIT | unit tests |
| `fast-check` | 4.10.2 | MIT | property-based tests |
| `@playwright/test` | 1.65.1 | Apache-2.0 | end-to-end smoke test |
| `@types/node` | 22.20.5 | MIT | Node.js types for config files and scripts |

Their own dependencies are pinned in `package-lock.json`.

Data files in `public/wordlists/`, copied unchanged from their sources (a unit test, `src/stitch-code/wordlists.test.ts`, checks the SHA-256 values below):

| File | Source | Version | Licence | Used for | SHA-256 |
|---|---|---|---|---|---|
| `eff_large_wordlist.txt` | [EFF large wordlist](https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt) by the Electronic Frontier Foundation, 7,776 words | 2016 | CC BY 4.0 ([EFF copyright page](https://www.eff.org/copyright)) | generated passphrases | `addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e` |
| `common-passwords.txt` | `Passwords/Common-Credentials/10k-most-common.txt` from [SecLists](https://github.com/danielmiessler/SecLists) by Daniel Miessler and contributors, 10,001 entries, renamed | commit `913b327` (2026-09-08) | MIT, licence text in `public/wordlists/SecLists-LICENSE.txt` | rejecting common custom passphrases | `68782d6a4a19a4768d5f15dd66bd534e7a33055cc755411e33f16d18c50fdcce` |

Licences checked 2026-11-16: the EFF copyright page says original material on its website may be distributed under the Creative Commons Attribution 4.0 International License; the SecLists licence comes from the GitHub licence API.

Chosen in the specs for later milestones (not installed or downloaded yet; each moves into a table above in the commit that adds it):

| Item | Version | Licence | Used for | Spec |
|---|---|---|---|---|
| `tesseract.js` (with `tesseract.js-core`) | 7.0.0 | Apache-2.0 | in-browser OCR | capture-ocr |
| Tesseract `eng` and `hin` language data ([naptha/tessdata](https://github.com/naptha/tessdata), 4.0.0) | 4.0.0 | Apache-2.0 | OCR languages, self-hosted | capture-ocr |
| `pdf-lib` | 1.17.1 | MIT | PDF generation | pdf-regeneration |
| `@pdf-lib/fontkit` | 1.1.1 | MIT | custom font embedding | pdf-regeneration |
| Noto Sans Devanagari ([notofonts/devanagari](https://github.com/notofonts/devanagari)) | 2.007 | SIL OFL 1.1 | Hindi text | pdf-regeneration |
| `qrcode` | 1.5.4 | MIT | stitch-code QR encoding | stitch-code |
| `jsqr` | 1.4.0 | Apache-2.0 | stitch-code QR decoding | stitch-code |
| [Qwen/Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) | revision `cdbee75` | Apache-2.0 | optional LLM in the Modal app (not shipped in the web app) | llm-adapter |
| vLLM ([vllm-project/vllm](https://github.com/vllm-project/vllm)) and the [Modal vLLM example](https://modal.com/docs/examples/vllm_inference) ([modal-labs/modal-examples](https://github.com/modal-labs/modal-examples)) | vLLM 0.21.0 | Apache-2.0 (vLLM), MIT (modal-examples) | optional Modal app, adapted from Modal's example | llm-adapter |

The Modal app pattern comes from Modal's published example and will be credited in `modal/stitchform_llm.py`. Licences above are from the GitHub licence API and npm, checked 2026-11-15.

Services and tools used while building (not shipped): Kiro, Context7 (documentation lookups), GitHub Actions (CI, runs only after the repository is pushed).

## Optional LLM help: what it costs

LLM help is off by default and the app works fully without it. If you deploy the optional Modal app: Modal's Starter plan includes "$30 / month free credits" ([modal.com/pricing](https://modal.com/pricing)), but Modal's billing docs say "you must have a payment method on file in order to use Modal" ([Modal billing](https://modal.com/docs/guide/billing)). The planned GPU (Nvidia L4) is listed at $0.000222 per second. Set a workspace budget and spend limit before deploying ([Modal budgets](https://modal.com/docs/guide/budgets)). Full setup steps arrive with the llm-adapter feature.

## License

[MIT](LICENSE)
