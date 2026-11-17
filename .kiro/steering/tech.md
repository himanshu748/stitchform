---
inclusion: always
---

# Tech stack and rules

## Stack

- Vite + TypeScript (strict), static single-page app, no backend. `vite build` writes plain files to `dist/`.
- Tests: Vitest for unit tests, fast-check for property-based tests, Playwright for one end-to-end smoke test of the typed, no-LLM path.
- Planned libraries (each confirmed in docs before use): Tesseract.js (OCR in a Web Worker, self-hosted `eng` and `hin` language data), pdf-lib with @pdf-lib/fontkit (PDF regeneration, Devanagari-capable OFL font), a QR encoder and decoder, Web Crypto (PBKDF2-HMAC-SHA256 600,000 iterations, AES-GCM), Web Speech API.
- Optional Modal app in `modal/` (Python) that serves an open-weights model through vLLM's OpenAI-compatible server. The agent never deploys it.

## Commands

- `npm run dev`: local dev server.
- `npm run typecheck`: `tsc --noEmit`.
- `npm test`: `vitest run` (unit and property tests, default fast-check run count).
- `npm run build`: typecheck, then `vite build`.
- `npm run test:e2e`: Playwright against `vite preview` on port 4173.
- `FC_NUM_RUNS=<n> npm test`: lower or raise the fast-check run count (read in `vitest.setup.ts`).

## Hard rules

1. **Confirm every API in docs before writing code.** Use the Context7 MCP server (`resolve-library-id`, then `query-docs`) or the library's official docs site. Never guess a signature, option name or config key. Record notable lookups in KIRO_USAGE.md (library, question, what it changed).
2. **Free tiers only.** Any runtime LLM is a free tier or local: `none` (default), Modal (user-deployed on the Starter plan free credits), Ollama (local), Gemini is hidden because the browser/free-tier gate was not confirmed.
3. **One LLM adapter.** All LLM calls go through `src/llm/`. Nothing else may call a provider. The rule-based mapper is the default and the fallback whenever the LLM is off, slow, or returns something that fails validation. LLM output is a suggestion and must pass the same validators as typed input.
4. **No secrets in the repo or logs.** API keys come from the user at runtime and are held in memory by default. Config files reference environment variables such as `${CONTEXT7_API_KEY}`, never literal keys.
5. **Never publish.** Do not run `git push`, `gh repo create`, `vercel`, `netlify deploy`, `modal deploy`, `modal serve` or `modal run`. The commit-guard hook blocks these unless the user sets `STITCHFORM_GO=1` themselves.
6. **New dependencies** must be added to README "Pre-existing work" with their licence in the same commit. The commit-guard hook checks this.

## Testing standards

- Pure logic modules (`form-model`, `mapping`, `validation`, `stitch-code`, `llm`) have no DOM dependency and carry the property tests.
- Property tests live next to the code as `*.property.test.ts`; unit tests as `*.test.ts`.
- Required properties: P1 every required field is filled or flagged; P2 date parse/format round-trips for every supported format, including Devanagari digits. Extras: P3 stitch-code round-trip, P4 mapping idempotence, P5 LLM output never marks an invalid value as filled.
- Keep property tests deterministic enough to reproduce: when one fails, record the seed and counterexample in the commit message or KIRO_USAGE.md.

## Code style

- ES modules, named exports, no default exports in `src/` except where a tool requires it.
- Prefer small pure functions with explicit types over classes.
- No `any`. Use `unknown` and narrow.
- UI text lives in one strings module per language so it can be checked for em dashes and translated.
