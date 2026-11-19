# How Stitchform uses Kiro

This file answers each Kiro write-up question in the [Kiroween 2026 rules](https://kiroween.devpost.com/rules). It records only what has actually happened, and it is updated after each task. Last update: 2026-11-17. The local application is implemented. Earlier Kiro evidence is preserved below; the Codex continuation and unverified Kiro/device/hosted steps are explicitly identified.

## Kiro surfaces used and how they differed

| Surface | Used so far | What it was used for |
|---|---|---|
| Kiro CLI 3.3.0 (`kiro-cli`) | Yes | Validating the custom agent (`kiro-cli agent validate`, `kiro-cli agent list`), checking MCP config (`kiro-cli mcp list`, `kiro-cli mcp status`), and one real hook smoke test with `kiro-cli chat` (below). |
| Kiro CLI driven over ACP by T3 Code | Yes | The coding agent that wrote PLAN.md and the M1 files runs in T3 Code. That session's workspace root is a parent folder, not this repository, so this repository's `.kiro` hooks did **not** fire for its edits. To test the hooks for real, a separate `kiro-cli chat` run was started with this repository as its working directory. |
| Kiro IDE | Not yet | Planned for the IDE-only features listed in "Steps for you in the Kiro IDE". |
| Kiro Web, Kiro Crew | No | Not planned. |

Differences found so far:

- `kiro-cli chat --no-interactive` uses the v2 agent engine unless told otherwise (from `kiro-cli chat --help`). File and task triggers (File Save, Post Task Execution) and Session Start are V3 features, so the smoke test passed `--v3`.
- The `{{filePath}}` template variable described in the [IDE 1.0 hooks page](https://kiro.dev/docs/ide/whats-new-v1/hooks/) was **not** substituted by CLI 3.3.0: the hook received the literal text `{{filePath}}` as an argument. The file path did arrive in the stdin payload as `file_path` (absolute). The hook scripts now read the payload only.
- In the PreToolUse payload from CLI 3.3.0 the shell tool appears as `tool_name: "execute_bash"` with `tool_input.command`, even though the hook matcher is the `shell` category.
- `kiro-cli chat` has a `--mode spec` option for the V3 agent, which may let specs be driven from the CLI. Not tried yet.

## Custom agents

`.kiro/agents/form-qa.json` is a read-only reviewer. It checks code, sample fixtures and generated PDFs against the specs and steering for privacy, accessibility, demo-data labelling and spec conformance, and reports findings with severity, file and line.

- Tools: `read`, `shell` and the Context7 MCP server (`@context7`).
- Permissions (CLI V3 `permissions.rules`): file writes denied everywhere; shell allowed only for `npm test`, `npm run typecheck`, `npx vitest run *`, `git status`, `git diff`, `git log`; shell denied for `git commit`, `git push`, `git reset`, `rm`, `vercel`, `netlify`, `modal` and `gh`.
- Resources: all steering files and PLAN.md, because the [custom agents docs](https://kiro.dev/docs/custom-agents/) say custom agents do not load steering automatically unless listed.
- Format checked against the [configuration reference](https://kiro.dev/docs/custom-agents/configuration-reference/).

Status: `kiro-cli agent validate --path .kiro/agents/form-qa.json` exits 0 and `kiro-cli agent list` shows `form-qa` as a workspace agent in "v3 format". Its final code/sample review has not completed. A read-only attempt with Kiro CLI 3.4.0 on 2026-11-17 failed at the monthly request limit before review. Do not count Codex review or definition validation as an executed Kiro custom-agent review. Impact from a Kiro review is not yet demonstrated.

## Agent hooks

Four hook files in `.kiro/hooks/`, written to the `"version": "v1"` schema on the [hooks page](https://kiro.dev/docs/hooks/) with trigger names from the [hook types page](https://kiro.dev/docs/hooks/types/). Scripts are in `scripts/hooks/` and read the event JSON from stdin.

| Hook | Trigger | What it does |
|---|---|---|
| `test-on-save` | `PostFileSave`, matcher `src/.*\.ts$` | Runs `vitest related <file> --run --passWithNoTests` for the saved file. Exit 1 with the failing test output when tests fail, so the agent sees it. |
| `doc-sync` | `PostTaskExec` | Agent prompt: after a spec task, update README.md and KIRO_USAGE.md only if behaviour, commands, dependencies, privacy or Kiro config changed; never invent numbers; no em dashes. |
| `commit-guard` | `PreToolUse`, matcher `shell`, timeout 120 s | Blocks `git push`, `gh repo create`, `vercel`, `netlify deploy`, `modal deploy/serve/run` and `npm publish` unless the user set `STITCHFORM_GO=1`. On `git commit` it checks that `.kiro` is not git-ignored, `.gitignore` does not mention `.kiro`, LICENSE is MIT, no `.env` file or secret-like string is staged, no em dash is in docs or UI strings, sample files carry the SAMPLE label, and every npm dependency is listed in README "Pre-existing work"; then it runs typecheck and the tests with `FC_NUM_RUNS=20`. Internal deadline 100 s, failing closed. |
| `hook-smoke` | `SessionStart`, `PostFileSave`, `PreToolUse` (shell) | Appends one JSON line per event to `reports/raw/hook-smoke.log`, to prove which triggers fire and to record the real payload shape. |

Blocking exit code: the [hook actions page](https://kiro.dev/docs/hooks/actions/) says any non-zero exit blocks a Pre Tool Use call, and the [IDE 1.0 hooks page](https://kiro.dev/docs/ide/whats-new-v1/hooks/) says exit code 2 blocks and other non-zero codes are errors. The guard uses exit 2, which blocks under both readings.

### Smoke test result (2026-11-15, Kiro CLI 3.3.0)

Command, run once from the repository root:

```sh
kiro-cli chat --no-interactive --v3 --trust-workspace --trust-tools=read,write,shell,@context7 "Hook smoke test. ... 1) Create src/smoke/hook-smoke-target.ts ... 2) Run git push --dry-run once ... 3) Call the context7 MCP tool resolve-library-id for pdf-lib ... 4) Report for each step whether a hook ran ..."
```

What happened, from the CLI output and `reports/raw/hook-smoke.log`:

| Check | Result |
|---|---|
| `SessionStart` fired | Yes. Payload keys: `session_id`, `hook_event_name`, `cwd`. |
| `PostFileSave` fired when the agent wrote `src/smoke/hook-smoke-target.ts` | Yes. Payload keys: `session_id`, `hook_event_name`, `cwd`, `file_path` (absolute path). `{{filePath}}` was passed through literally. |
| `PreToolUse` fired for the shell tool | Yes. `tool_name` was `execute_bash`; `tool_input` keys were `command`, `description`, `cwd`, `run_in_background`, `timeout`. |
| `commit-guard` blocked `git push --dry-run` | Yes. The CLI showed the tool call as "Failed", and the agent quoted the guard's message and did not retry. |
| `test-on-save` ran | Not directly observed. The script writes no log, and the agent reported no hook output for the file step. The `hook-smoke` entry proves `PostFileSave` fired for that same file with the same matcher. Replaying the recorded payload into `test-on-save.mjs` by hand ran Vitest as expected, and a planted failing test made it exit 1. |
| `doc-sync` | Not exercised yet: it fires on `PostTaskExec`, and no spec tasks exist yet. |
| Context7 MCP from Kiro | Worked. `@context7/resolve-library-id` returned `/hopding/pdf-lib` as the top match for pdf-lib. |

One `HTTP 429 ThrottlingException` (`USER_REQUEST_RATE_EXCEEDED`) from the Kiro service appeared mid-run; the run still completed. Credits used by the run: not measured. The smoke file was deleted afterwards and never committed.

### Manual checks of the guard

Run with simulated payloads during M1:

- `{"tool_name":"shell","tool_input":{"command":"git push"}}` exits 2.
- A staged `.env` (planted with `git add -f .env`, then removed) makes a `git commit` payload exit 2.
- Before README had a "Pre-existing work" section, a `git commit` payload exited 2 listing the six undocumented dependencies, so README was committed before the hooks.
- A clean `git commit` payload exits 0 after typecheck and tests pass.

### Known gap

The guard only sees commits the Kiro agent makes through its shell tool. Commits made by hand, or by an agent whose workspace is not this repository (like the T3 Code session that wrote M1), skip it. Backstops: once the guard existed, it was run by hand with a simulated payload before each later M1 commit (the PLAN, LICENSE, scaffold and steering commits came before it), and `.github/workflows/ci.yml` runs the same checks (`node scripts/hooks/commit-guard.mjs --ci --skip-slow`) plus typecheck, tests and build on every push and pull request once the repository is on GitHub.

## Spec-driven development vs vibe coding

### How the specs are structured

Milestone M2 wrote one spec per feature in `.kiro/specs/<name>/`, using the folder names from PLAN.md section 5: `capture-ocr`, `field-mapping`, `voice-answers`, `llm-adapter`, `validation`, `pdf-regeneration`, `stitch-code`, `lab-ui`, `sample-forms`, `accessibility`, `deliverable-docs`. Each has the three files described in the [Kiro specs docs](https://kiro.dev/docs/specs/) and [feature specs docs](https://kiro.dev/docs/specs/feature-specs/):

- `requirements.md`: introduction, glossary, then numbered requirements (1, 2, ...) with numbered acceptance criteria (1.1, 1.2, ...) in EARS form (`WHEN ... THE SYSTEM SHALL ...`, plus `IF ... THEN`, `WHILE` and `WHERE`). The fixed requirements from PLAN.md section 5 (voice notice, LLM key handling, passphrase rules) are carried into `voice-answers`, `llm-adapter` and `stitch-code`.
- `design.md`: an "External APIs" table first, with the official doc URL for every API or fact the design relies on, then module layout, TypeScript interfaces, data flow, error handling, a "Correctness properties" section and testing. Anything that could not be confirmed is marked "not confirmed" and either left out or gated behind a task (for example the Gemini provider, Modal CORS preflight behaviour, and the Chrome-specific voice wording).
- `tasks.md`: Markdown checkboxes, one per commit-sized task, each ending with `_Requirements: x.y_` and, where relevant, `Property: Pn`.

The properties P1 to P5 from PLAN.md section 7 are tied to requirement IDs in one table that appears in the `field-mapping`, `validation` and `stitch-code` designs (and P5 in `llm-adapter`): P1 to field-mapping 5.1, 5.2, 5.4 and validation 4.1; P2 to validation 1.1, 1.2, 1.4, 1.8; P3 to stitch-code 5.1, 5.2, 2.3; P4 to field-mapping 6.1, 6.2; P5 to llm-adapter 5.1, 5.2, 5.3.

How they were written: by the T3 Code agent (Kiro CLI over ACP), as plain files, not through the Kiro spec workflow UI or `kiro-cli chat --mode spec`. The docs pages read do not show the exact `tasks.md` syntax that Kiro's task runner expects, so whether Kiro's task view picks these files up as-is is not known yet (listed in "Steps for you in the Kiro IDE").

What writing the specs first changed:

- Confirming APIs before the design changed several plans. pdf-lib's open Hindi shaping issue ([#1409](https://github.com/Hopding/pdf-lib/issues/1409)) moved Hindi PDF text to a canvas-image path. vLLM's docs warn that `--api-key` leaves `/invocations` unauthenticated, so the Modal design uses Modal proxy auth instead. Modal's billing docs say a payment method must be on file, which answers an open question in PLAN.md. Gemini's browser CORS could not be confirmed, so that provider is hidden behind a gate task.
- PDF upload was dropped from v1 capture, because OCR on a PDF needs a PDF renderer that no spec has confirmed.

The requirements made the privacy and validation invariants concrete. The choice-label idempotence issue below is an observed PBT result; no development-time saving is measured. A brief seam visual pass was committed separately as 5200fe7, then corrected for reduced motion and capped field-only feedback. It was a Codex experiment informed by the already-existing specification, so it is not a genuinely spec-free Kiro comparison. The planned strict spec-versus-vibe experiment remains unverified.

## Steering strategy

Four files in `.kiro/steering/`, with front matter from the [steering docs](https://kiro.dev/docs/steering/):

- `product.md` (`inclusion: always`): who Stitchform is for, the privacy stance, honesty rules (no fabricated data, demo data labelled, no real government forms), what "done" means, judging criteria.
- `tech.md` (`inclusion: always`): stack, commands, and the hard rules: confirm every API in Context7 or official docs, free tiers only, one LLM adapter with a rule-based default, no secrets, never publish.
- `structure.md` (`inclusion: always`): module layout, spec folder names, test and fixture placement, "never ignore .kiro".
- `form-privacy-and-i18n.md` (`inclusion: fileMatch` on `src/mapping/**`, `src/validation/**`, `src/voice/**`, `src/stitch-code/**`, `src/llm/**`): handling personal answers, voice and LLM notices, English and Hindi label synonyms, Devanagari digits, Indian date formats, properties P1 and P2.

The idea: rules that apply everywhere stay short and always loaded; the detailed personal-data and language rules load only when Kiro touches code that handles answers. The domain file was the most directly applicable constraint during the continuation: keys, images and signatures were kept out of stitch-code payloads, and recognition remained opt-in. This is a qualitative implementation observation, not a measured comparison of steering effectiveness.

## MCP

`.kiro/settings/mcp.json` configures the [Context7](https://github.com/upstash/context7) remote server (`https://mcp.context7.com/mcp`), with `resolve-library-id` and `query-docs` auto-approved because they only read documentation. The format follows the [Kiro MCP configuration docs](https://kiro.dev/docs/mcp/configuration/); the URL comes from Context7's README and client setup page, which also say an API key is optional. No key is committed; README explains how to add one through `${CONTEXT7_API_KEY}`.

- `kiro-cli mcp list` shows `context7` for the default agent.
- In the smoke test, Kiro called `@context7/resolve-library-id` and got `/hopding/pdf-lib`.

### Documentation lookups so far

The M1 scaffold was written by the T3 Code agent, which has no MCP connection to this repository's Context7 server, so it queried Context7's public REST API (`https://context7.com/api/v2/...`, the same index) instead. Each lookup and what it changed:

| Library (Context7 ID) | Question | What it changed |
|---|---|---|
| Vitest (`/vitest-dev/vitest/v5.0.3`) | Config file shape, `include`, `environment`, `vitest related` | `vitest.config.ts` uses `defineConfig` from `vitest/config`. The docs note Vitest starts in watch mode by default, so `test-on-save` passes `--run` to `vitest related`. |
| fast-check (`/dubzzz/fast-check`) | How to set the run count for all properties | `vitest.setup.ts` calls `fc.configureGlobal({ numRuns })` from `FC_NUM_RUNS`, which lets commit-guard run fewer cases while `npm test` keeps the default. |
| Playwright (`/microsoft/playwright/v1.64.1`) | `webServer` options | `playwright.config.ts` uses `url` (the docs mark `port` as deprecated) and `reuseExistingServer: !process.env.CI`, as the docs recommend. |
| Vite (`/vitejs/vite/v8.3.5`) | Client types and preview port | `tsconfig.json` sets `types: ["vite/client", "node"]`; `vite.config.ts` pins `preview.port` to the documented default 4173 with `strictPort` so the Playwright URL is stable. |

Package versions were taken from `npm view` on 2026-11-15. The installed Vitest is 5.1.0 and the newest Vitest docs version in Context7 was 5.0.3, so the lookups used 5.0.3.

M2 lookups (spec phase), again through Context7's public REST API from the T3 Code session:

| Library (Context7 ID) | Question | What it changed |
|---|---|---|
| pdf-lib (`/hopding/pdf-lib`) | Custom fonts with fontkit, PNG/JPEG embedding, metadata, `save` options, embedding pages of another PDF | pdf-regeneration design: `registerFontkit` before `embedFont`; sample PDFs saved with `useObjectStreams: false` so the "SAMPLE / DEMO DATA" title stays readable for commit-guard; `embedPdf` + `drawPage` for the "over original" background. |
| Tesseract.js (`/naptha/tesseract.js/v7.0.0`) | `createWorker` options for self-hosting, `recognize` output | capture-ocr design: `corePath` must be a directory holding all four core builds; since v6 only `text` is returned by default, so the design requests `{ blocks: true }`; `rotateAuto` replaces a hand-written deskew step. |
| fast-check (`/dubzzz/fast-check`) | `fc.date` options, `fc.record`, `fc.uint8Array` | validation design: P2 generates `{ y, m, d }` integers instead of `fc.date`, so no time zone enters the date property. |
| Playwright (`/microsoft/playwright/v1.64.1`) | `page.screenshot` from a Node script | sample-forms design: sample PNGs are rendered by headless Chromium through Playwright (already a dev dependency) instead of adding a Node canvas library. |
| Library search (`/api/v2/libs/search`) for `tesseract.js`, `qrcode`, `vllm` | Which IDs exist | Found the IDs above; for vLLM the CLI flags were read on [docs.vllm.ai](https://docs.vllm.ai/en/latest/cli/serve.html) directly. |

Official sites were read directly for the rest (cited in each design.md): MDN (Web Speech, Web Crypto, CompressionStream, getUserMedia, fetch, AbortSignal, RequestInit, Secure contexts, Web Storage, FontFace, canvas) and MDN browser-compat-data, Modal docs and pricing, vLLM docs, Ollama docs, Google's Gemini API docs, Chrome's Local Network Access post, npm metadata, Hugging Face model API, EFF and W3C WCAG 2.2.

## Property-based testing

fast-check 4.10.2 is set up (`vitest.setup.ts`, `FC_NUM_RUNS`). Two properties cover the commit-guard command classifier in `scripts/hooks/guard-rules.test.mjs`:

- Appending `&& git push` to any chain of harmless commands always classifies as "publish".
- A plain `git commit -m "<message>"` is always "commit", whatever the message says (so a commit message that mentions `git push` does not trip the guard).

Neither has found a bug yet.

### Product properties implemented so far

Each one is tied to requirement IDs in the spec that owns it (the "Correctness properties" tables in `.kiro/specs/field-mapping/design.md`, `.kiro/specs/validation/design.md`, `.kiro/specs/stitch-code/design.md` and `.kiro/specs/llm-adapter/design.md`, and the task 1 to 6 conventions in the llm-adapter design). `npm test` runs them at fast-check's default 100 cases; commit-guard runs them at 20.

| Property | File | What it checks | Result so far |
|---|---|---|---|
| P2 date round-trip (validation 1.1, 1.2, 1.4, 1.8) | `src/validation/dates.property.test.ts` | For any valid `{ y, m, d }` in 1900 to 2099, any of the five four-digit-year formats and ASCII or Devanagari digits, `parseDate(formatDate(d, f, digits))` returns `d`. `D-M-YY` is checked for role "other" and years 2000 to 2099. Two extra checks: a parsed date's canonical DD/MM/YYYY value parses back to the same date, and any written day/month/year numbers either parse to exactly those numbers or give `date-impossible` (never a different date). | Passed at 100 cases and at 20,000 cases (`FC_NUM_RUNS=20000`). No bug found. |
| Two-digit DOB pivot (validation 1.6) | same file | For any date and any `today`, a date of birth written as `D-M-YY` keeps its day, month and last two year digits, is not after `today`, and adding 100 years would put it after `today` (the latest such year). Only 29 February may fail, as `date-impossible`, when the resolved year is not a leap year. | Passed at 100 and 20,000 cases. No bug found. |
| Validator totality (validation 5.3) | `src/validation/validators.property.test.ts` | For any field of any type (choice fields with 0 to 5 options that may repeat or differ only in case) and any string, including lone surrogate halves, text over the 200-character parsing limit and runs of up to 5,000 copies of one character, `validateField` returns a well-formed outcome: issues carry the field ID and the severity from the table, `ok` outcomes have no error, failed ones have at least one. | Passed at 100 and 5,000 cases. No bug found. |
| Validator idempotence (validation 3.5) | same file | If a raw answer validates to a value, validating that value again returns the same value with no new issue. A second check feeds every option of a generated choice field, as printed and without its bracketed hint, and requires the returned option to validate back to itself. A sampling check confirms the "ok" branch is reached for all seven field types, so the property is not vacuous. | Found one real bug, fixed in `106fbcc` (see below). Passes at 100 and 5,000 cases since. |
| Required never "no answer" (validation 4.1, supports P1) | same file | A required field of any type except `photo` never gets `ok` with an empty value; `photo` always gets exactly the `photo-paste-after-print` info issue. | Passed at 100 and 5,000 cases. No bug found. |
| P1 required fields filled or flagged (field-mapping 5.1 to 5.5, validation 4.1) | `src/mapping/map-answers.property.test.ts` | For any valid form model (1 to 20 fields of every type), 0 to 12 answers (prompted answers aimed at a field with valid, invalid, blank or random text, prompted answers for a field not on the form, free text naming fields by label or synonym in English or Hindi, repeated `seq` values) and any signature set: every field appears once; a `filled` value validates back to itself; `flagged` has an error; `empty` only for fields that are not required and never with an error; signature fields are filled only when their ID is in the signature set; photo fields are always `empty` with the info issue. A second check maps no answers and expects exactly `required-missing` or `signature-missing`. A sampling check confirms required fields reach all three statuses and that free text fills some fields. | Passed at 100 and 5,000 cases. No bug found. |
| P4 mapping idempotence (field-mapping 6.1, 6.2) | same file | The same input always gives an equal result. Mapping `toPromptedAnswers` of a result again gives every field the same status, value, raw text and provenance, adds no issue, and leaves `unmatched` empty; turning that second result into answers gives the same answers again. | Passed at 100 and 5,000 cases. No bug found. Writing it led to a spec change: the first draft of Req 6.2 said the second result "equals" the first, but two warnings cannot survive the round trip by design (`date-two-digit-year` once the date is stored as DD/MM/YYYY, and `free-text-ignored` because free text is not carried over). Req 6.2 and the P4 row in the design now say exactly what is kept. |
| P3 stitch-code round-trip (stitch-code 5.1, 5.2, 2.3, 3.4) | `src/stitch-code/round-trip.property.test.ts` | For any form ID and answers (field IDs and `fc.string({ unit: "grapheme" })` text, sometimes long enough to pass 64 KiB) and any passphrase: sealing then opening with the same passphrase returns exactly the form ID and answers, and sealing says `too-large` exactly when the payload JSON is over 64 KiB. A passphrase whose normalised form (NFC, trimmed) differs, such as a near miss with one character added or dropped or in upper case, gives `cannot-open` and no data. XOR-ing any one byte with any non-zero mask gives `not-stitch-code` for bytes 0 to 7 (magic, version, KDF ID, iteration count) and `cannot-open` for the salt, IV, ciphertext and tag. A sampling check confirms both sides of the 64 KiB limit and non-ASCII text are generated. Test-only shortcut, as the stitch-code design says: the property calls the internal `sealWithIterations` and `openWithBounds` with 1,000 PBKDF2 iterations so it runs in Vitest in under a second; the production count of 600,000 is checked by one example test in `src/stitch-code/stitch-code.test.ts`. | Passed at 100 cases (0.4 s for the three properties) and at 5,000 cases (14.4 s). No bug found. |
| No-LLM path sends nothing (llm-adapter 1.1, 1.4) | `src/llm/adapter.test.ts` | For any form, answers and signature set from the P1 generators, any `today`, and a signal that may already be cancelled, mapping with the rules and then calling `assist` with provider `none` returns `off` with the rule-based result object unchanged. Meanwhile `fetch`, `XMLHttpRequest`, `WebSocket` and `EventSource` are stubs that record any call and throw, and none is called. | Passed at 100 cases and at 5,000 cases (1.4 s). No bug found. |
| LLM request holds labels and answers only (llm-adapter 3.2) | `src/llm/prompt.test.ts` | For any form and answers from the P1 generators, the request `buildRequest` makes, once serialised to JSON, has only the key paths `fields[].id`, `label`, `type`, `required`, `choices` and `answers[].text`, `promptedFieldId`, `lang`, and only string or boolean values, so no bounding box, page or order number is in it. Every field appears once in form order, `choices` only on choice fields, and every `promptedFieldId` names a field of the form. | Passed at 100 cases and at 5,000 cases (0.9 s). No bug found. |
| Reply parsing is total and exact (llm-adapter 5.5) | `src/llm/parse.test.ts` | For any text (the validator totality strings, `fc.json()`, contract-shaped replies built from `fc.record` objects with random field IDs and values up to 260 characters, the same inside a code fence, and the same cut off at any point), `parseSuggestions` returns at most 100 items, each with a string field ID and exactly one string value or note of at most 200 characters, and agrees with `parseReply`. A second check: for any contract-shaped object, the parsed items are exactly its suggestions, then its warnings, with over-long ones dropped. A sampling check confirms that some generated replies do give items. | Passed at 100 and 5,000 cases (about 0.5 s per property at 5,000). No product bug found. The sampling check caught a gap in the test itself while it was written: the first generator only made cut-off replies, almost never a complete one, so no generated reply gave any item. The complete contract-shaped branch was added before the commit. |
| P5 LLM output is only a suggestion (llm-adapter 5.1, 5.2, 5.3, 5.5) | `src/llm/merge.property.test.ts` | For any form, answers and signature set from the P1 generators, any `today`, and any string a fake provider returns (`fc.string()`, the validator totality strings, JSON built from `fc.record` objects with the form's field IDs, an ID not on the form and random IDs, and values aimed at a field that are valid, invalid or random for its type, the same in a code fence, the same cut off anywhere, and JSON of the wrong shape), `assistWithProvider` (the provider part of `assist`, see the llm-adapter task 5 conventions) never rejects, sends exactly one request (the `buildRequest` output) and leaves the rule-based result unchanged. A reply that is not the expected JSON gives `fallback` "bad-output" with the rule-based result. Otherwise no field is `filled` with a value that fails `validateField`; fields filled from typed, spoken or stitch-code answers, signature fields and photo fields are exactly as before; a field the model filled was empty or flagged, ends with `llm-suggestion` and holds the validated form of the first value the model suggested for it; every other field gains at most one `llm-rejected`. The `accepted` and `rejected` counts and the notes match the result. A sampling check (300 cases) confirms that ok and bad-output outcomes, fills (of flagged fields too), rejections, value suggestions aimed at protected fields and notes all occur. | Passed at 100, 5,000 (2.4 s) and 20,000 cases (11.0 s; run with `--testTimeout=600000`, because Vitest stops a test after 5 s by default). No bug found. Writing it corrected one claim in the merge docs from the task before: the first draft said the merged result lists fields in form order, but the property generated field IDs such as `"0"` and `"4"`, which JavaScript always lists before other keys. The docs and tests now promise one entry per field, not an order. |
| P1 re-check after the merge (field-mapping 5.1, validation 4.1) | same file | `mergeSuggestions` given any list of suggestions directly (no parser caps: any field ID, values of any length, notes, value and note together) and a rule-based result with any subset of its entries removed: every field appears once, a `filled` value validates back to itself, `flagged` has an error, `empty` only for fields that are not required (photos aside) and never with an error, and a required field whose entry was missing and that was not filled gets `required-missing` or `signature-missing`. Fields whose entry was there follow the same rules as in P5. | Passed at 100, 5,000 (2.1 s) and 20,000 cases (9.0 s). No bug found. |
| The app's path is the P5 path (llm-adapter 2.1, 2.2, 5.5) | `src/llm/openai-compatible.test.ts` | For any form, answers and signature set from the P1 generators, any `today`, and any model text (`fc.string()`, the validator totality strings, `fc.json()`, and replies with suggestions for the form's fields), `assist` with a Modal or an Ollama configuration, whose `fetch` is a fake returning that text as a chat completion, gives exactly the outcome `assistWithProvider` gives with a fake provider returning the same text. It sends one request, whose user message is the `buildRequest` JSON. So P5, which drives `assistWithProvider`, covers the code the app runs. | Passed at 100 and 5,000 cases (2.1 s). No bug found. |

#### Bugs the properties caught

1. **Long choice option did not validate back to itself (validation Req 3.5).** The choice idempotence property found this while the validator properties were being written. Replayed afterwards with seed 1 against a copy of the old validator, it failed after 14 generated cases, and fast-check shrank it (564 shrink steps) to a choice field with a single option made of `/ (`, a hint of `!` and `*` characters, and `)`, 201 characters long, with `today` 1 January 1950. Typing just `/` matched the option through its "label without the bracketed hint" rule and returned the full 201-character label. Validating that label again gave `choice-unknown`, because choice input longer than the 200-character parsing limit was rejected before matching. So a value the validator itself produced failed on the next edit or refill. Fix (`106fbcc`): a choice field accepts input as long as its longest option label; `src/validation/validators.test.ts` keeps a unit test with the same shape (an option over 200 characters). Replaying the shrunk counterexample against the old copy gave `choice-unknown`; against the fixed validator it gives the same label back. Finding and shrinking this case took 458 s and 305 s in two seed-1 runs on this machine; the fixed property passes 100 cases in under a second.

All five product properties planned in PLAN.md section 7 (P1 to P5) are now in place. Since llm-adapter task 6, `assist` calls `assistWithProvider` with the real Modal or Ollama client, and the property above shows that this gives the same outcomes as the fake provider P5 uses.

## Kiro powers

Checked on 2026-11-15:

- `kiro-cli powers` offers `install` and `uninstall` (no list command).
- The public catalogue at [kiro.dev/powers](https://kiro.dev/powers/) listed 158 powers. It includes a Context7 power (source: `upstash/context7`, `plugins/context7-power`). A search of names and descriptions for "Modal" and "Vercel" found no match.
- No power was installed for this project. `kiro-cli powers` has no list command, and `~/.kiro` has no `powers` folder, so no installed power was found. The Context7 MCP server is already configured in this repository, so installing the Context7 power would duplicate it. Installing changes your user-level Kiro setup, so it is left as an optional step for you below.

## Kiro CLI vs IDE availability

From the Kiro docs (pages cited in PLAN.md section 8) and what was observed on this machine with Kiro CLI 3.3.0:

| Feature | Kiro CLI 3.3.0 | Kiro IDE | Observed here |
|---|---|---|---|
| Steering with inclusion modes | Yes (V3 full) | Yes | Files written; loading not yet checked in a session |
| Generate foundation steering from the UI | No | Yes | Written by hand instead |
| Specs (requirements, design, tasks) | Yes (`--mode spec` exists) | Yes | 11 specs written as files by the T3 Code agent; `--mode spec` not used; task-runner pickup not checked |
| Spec "Correctness" (properties from specs) | No | Yes | Not started |
| Hooks: SessionStart, PreToolUse, PostFileSave | V3 | Yes | Fired in the smoke test |
| Hooks: PostTaskExec | V3 | Yes | Not exercised yet |
| `{{filePath}}` in hook commands | Not substituted in 3.3.0 | Documented for IDE 1.0 | Payload `file_path` used instead |
| Prompt Submit hooks that block | No | Yes | Not used |
| Custom agents in `.kiro/agents/` | Yes | Yes | `form-qa` validates and is listed |
| Workspace MCP (`.kiro/settings/mcp.json`) | Yes | Yes | Context7 call worked |
| Powers (install, create) | V3 | Yes | None installed |

## Steps for you in the Kiro IDE

- [ ] Run the spec "Correctness" capability on the `field-mapping`, `validation` and `stitch-code` specs (they now exist), and compare the generated properties with P1 to P5 (for the property-based testing section).
- [ ] Open `.kiro/specs/` in the IDE and check that each `tasks.md` shows up as runnable tasks; tell me if the checkbox format needs changing.
- [ ] Optional: run "Analyze Requirements" on `stitch-code` or `llm-adapter` and tell me what it finds.
- [ ] Optional: generate foundation steering files from the IDE and compare them with the hand-written `product.md`, `tech.md` and `structure.md`.
- [ ] Optional: open the Agent Hooks panel to confirm the four hook files load in the IDE, and record the panel for the video.
- [ ] Optional: install the Context7 power from the Powers panel or [kiro.dev/powers](https://kiro.dev/powers/) if you want to try powers; tell me and I will record the result here.

## Codex continuation, 2026-11-17

After Kiro's reported monthly usage limit interrupted the build, the owner continued this thread with Codex. Changes from this point are Codex work, not additional Kiro execution. The inherited LLM client and key store passed 558 tests and TypeScript checks before being committed separately. Existing Kiro evidence above remains historical evidence at its recorded boundary.

2026-11-19: Codex resumed after another T3 server restart and restored the local Vite server. Deliverable-docs task 3 now has Vitest checks for the required social-post tag and blog hackathon disclosure. These checks do not publish either draft or replace the pending Kiro custom-agent review. No new Kiro request was made in this resumption.

Official docs refreshed: Modal's vLLM example and billing/proxy-auth guides, Google's API-key guide (Gemini still not confirmed for this browser/free-tier implementation), Ollama FAQ, and the vLLM v0.21.0 source. The pinned vLLM parser uses separate argv values for `--allowed-origins` (`list[str]` with `nargs='+'`), rather than the spec's proposed JSON argument. The prepared Modal file converts a JSON configuration variable into those argv values. Only `py_compile` ran; no deployment, image build, GPU, CORS or model inference was performed.

Context7 MCP was used directly by Codex to resolve `/hopding/pdf-lib` and `/naptha/tesseract.js/v7.0.0`, then query PDF drawing and self-hosted OCR. It confirmed bottom-left PDF coordinates, font measurement, image embedding, the local worker/core/language paths, and explicit `blocks: true` output for word boxes. This is additional docs evidence, not a Kiro MCP run.

### Local application evidence from the Codex continuation

The continuation built camera/upload processing, same-origin Tesseract workers, template/generic field detection, three bilingual fictional sample forms, PDF output, opt-in voice, the five-step lab interface and encrypted-code restoration. The runtime LLM path remains optional and untested against a live provider. The Modal file was syntax-checked only. No deployment, login, publication or billing action was taken.

Browser validation used Playwright after two in-app-browser snapshot calls returned `Preview automation snapshot timed out after 15000ms.` The visual references actually inspected were GOV.UK's Universal Credit entry page (strong hierarchy, explicit next actions, restrained navigation) and the Tesseract demo (document-first upload). Their assets, branding and copy were not reused. The moss/cream palette, paper illustration and seam treatment are original choices. Typography deliberately uses Georgia for warm headings, the platform sans stack for controls and body text, system monospace for lab labels, and bundled Noto Sans Devanagari for Hindi/canvas. Hindi font loading was checked in the browser.

The initial mobile layout placed the full-page preview before all answering/review controls. It was changed to a collapsible preview outside field-checking on narrow screens. A real downloaded Hindi PDF was rendered with Poppler and inspected: the sample watermark and the Hindi name remain visible and the name sits in its intended box. A scratch fontkit comparison on the Hindi phrase “प्रवेश के लिए क्षमा और श्रद्धा” failed with `ReferenceError: regeneratorRuntime is not defined` in @pdf-lib/fontkit 1.1.1 on Node 26.12.0. No comparison PDF was produced and no extra polyfill was added. The application uses the verified canvas path and does not import fontkit at runtime. A successful side-by-side fontkit capture and Firefox inspection remain undone.

Reports: `reports/ocr-measurements.json` records one run per generated image. Clean label recalls: admission 8/8, scholarship 7/7, hostel 9/10. Synthetic crumpled label recalls: 7/8, 7/7, 10/10, taking 5,023 ms, 876 ms and 2,235 ms respectively. These are text-label recall counts, not field-box accuracy, phone measurements or real crumpled-paper results. The earlier progress message understated the final hostel crumpled result; this saved report is the reference.

`reports/pbkdf2-measurement.json` records Chromium 159.0.8154.6 on Apple M4, macOS arm64: five runs of 600,000 PBKDF2-HMAC-SHA256 iterations to an AES-GCM-256 key, median 70.2 ms. Read the report for the actual browser version and run values; no low-end phone was available. The UI's timer covers encryption and QR generation as well, so it is not the isolated derivation benchmark.

Task ticks record implemented and tested work at the stated boundary. Remaining unchecked tasks include Kiro-specific executions, the strict vibe experiment, actual microphone checks, comparative Hindi rendering/Firefox and post-deployment checks. The final local validation result is recorded in `reports/local-verification.md` after checks finish. Manual VoiceOver and physical camera/microphone behaviour are not claimed.

Guard execution boundary in the continuation: Codex shell commits do not auto-fire the Kiro PreToolUse hook. The guard was invoked manually. An early sample metadata check failed because PDF title bytes were encoded; the generator gained an explicit SAMPLE comment and was regenerated before committing the samples. An asset commit command still ran after that failed manual check because its shell used command separators. Later commits used conditional chaining so a failed check stops the commit. The final all-files guard passed; this is not a claim that Kiro guarded every Codex commit.

### Restart recovery and lifecycle checks, 2026-11-17

After the T3 server restart cancelled the local Vite process, Codex restarted it at `http://127.0.0.1:5173/`. The requested read-only custom-agent review was attempted once from this repository with installed Kiro CLI 3.4.0:

```sh
kiro-cli chat --no-interactive --v3 --trust-workspace --agent form-qa --trust-tools=read,fs_read,grep,glob 'Read-only review: inspect src/ui/app.ts and src/voice/index.ts for lost answers, cancellation races, missing consent, stale QR/PDF results, keyboard/focus issues. Read relevant specs. Do not edit or run shell commands.'
```

The CLI returned HTTP 400 `ServiceQuotaExceededException`, reason `MONTHLY_REQUEST_COUNT`, request ID `bd8389a1-2f69-4dd6-8eef-8a9977333b01`. No review result was produced. The SessionStart hook did fire: the line at `2026-11-17T08:28:31.876Z` in `reports/raw/hook-smoke.log` is actual hook execution, separately from the failed review. No upgrade, overage, credit request or further retry followed. Test-on-save and doc-sync trigger evidence remain incomplete.

Codex added browser regressions for three reproduced failures: advancing to the next answer left voice running; editing the passphrase during derivation could show a QR encrypted with the previous passphrase; and template-loading failure during OCR preparation discarded the uploaded page. All three failed before the fixes and passed afterwards. A fourth regression reproduced stale QR/PDF links after a pending signature finished on another step; recalculation now removes those links without rebuilding the current answer view. The fixes stop voice when its answer view changes, bind asynchronous work to the current view/form/input revision, invalidate displayed codes when the passphrase changes, and keep the uploaded image in manual correction. Related cases cover pending signature conversion after Clear, wrong-passphrase rejection, closing an unlock before decryption finishes, and leaving Print before a PDF background finishes loading.

Voice errors now have actionable English/Hindi messages for the values listed in [MDN's SpeechRecognitionErrorEvent.error reference](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error), checked on 2026-11-17; unknown values use the typed-input fallback. Voice browser coverage uses a fake recogniser and does not establish microphone or language-pack operation. The delayed crypto tests use native Web Crypto with test-controlled completion. The keyboard-only sample path uses Tab, Enter, arrows and typing through PDF download; it deliberately leaves the signature missing and verifies that the app flags it. Final results: 594 unit/property tests across 40 files, 15 Chromium cases, strict TypeScript and the production build passed. See `reports/local-verification.md` for remaining limits.
