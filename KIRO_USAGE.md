# How Stitchform uses Kiro

This file answers each Kiro write-up question in the [Kiroween 2026 rules](https://kiroween.devpost.com/rules). It records only what has actually happened, and it is updated after each task. Last update: 2026-11-15, end of milestone M1 (Kiro foundation). Specs and app features come next, so several sections below say "not yet".

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

Status: `kiro-cli agent validate --path .kiro/agents/form-qa.json` exits 0 and `kiro-cli agent list` shows `form-qa` as a workspace agent in "v3 format". It has not reviewed anything yet because no feature code exists. Impact: not yet known.

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

Not started. Milestone M2 writes one spec per feature in `.kiro/specs/<name>/` (`requirements.md` in EARS notation, `design.md`, `tasks.md`), with folder names from PLAN.md section 5. One small part, the seam animation, will be vibe-coded first as a deliberate comparison. This section will compare the two once both have happened.

## Steering strategy

Four files in `.kiro/steering/`, with front matter from the [steering docs](https://kiro.dev/docs/steering/):

- `product.md` (`inclusion: always`): who Stitchform is for, the privacy stance, honesty rules (no fabricated data, demo data labelled, no real government forms), what "done" means, judging criteria.
- `tech.md` (`inclusion: always`): stack, commands, and the hard rules: confirm every API in Context7 or official docs, free tiers only, one LLM adapter with a rule-based default, no secrets, never publish.
- `structure.md` (`inclusion: always`): module layout, spec folder names, test and fixture placement, "never ignore .kiro".
- `form-privacy-and-i18n.md` (`inclusion: fileMatch` on `src/mapping/**`, `src/validation/**`, `src/voice/**`, `src/stitch-code/**`, `src/llm/**`): handling personal answers, voice and LLM notices, English and Hindi label synonyms, Devanagari digits, Indian date formats, properties P1 and P2.

The idea: rules that apply everywhere stay short and always loaded; the detailed personal-data and language rules load only when Kiro touches code that handles answers. Which file made the biggest difference: not known yet.

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

## Property-based testing

fast-check 4.10.2 is set up (`vitest.setup.ts`, `FC_NUM_RUNS`). So far the only properties are two on the commit-guard command classifier in `scripts/hooks/guard-rules.test.mjs`:

- Appending `&& git push` to any chain of harmless commands always classifies as "publish".
- A plain `git commit -m "<message>"` is always "commit", whatever the message says (so a commit message that mentions `git push` does not trip the guard).

Neither has found a bug yet. The product properties (P1 required fields filled or flagged, P2 date round-trip, P3 stitch-code round-trip, P4 mapping idempotence, P5 LLM output never marks an invalid value as filled) come with the pure-logic features in M3 to M6.

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
| Specs (requirements, design, tasks) | Yes (`--mode spec` exists) | Yes | Not started |
| Spec "Correctness" (properties from specs) | No | Yes | Not started |
| Hooks: SessionStart, PreToolUse, PostFileSave | V3 | Yes | Fired in the smoke test |
| Hooks: PostTaskExec | V3 | Yes | Not exercised yet |
| `{{filePath}}` in hook commands | Not substituted in 3.3.0 | Documented for IDE 1.0 | Payload `file_path` used instead |
| Prompt Submit hooks that block | No | Yes | Not used |
| Custom agents in `.kiro/agents/` | Yes | Yes | `form-qa` validates and is listed |
| Workspace MCP (`.kiro/settings/mcp.json`) | Yes | Yes | Context7 call worked |
| Powers (install, create) | V3 | Yes | None installed |

## Steps for you in the Kiro IDE

- [ ] Run the spec "Correctness" capability on the `field-mapping`, `validation` and `stitch-code` specs once they exist, and compare the generated properties with the hand-written ones (for the property-based testing section).
- [ ] Optional: generate foundation steering files from the IDE and compare them with the hand-written `product.md`, `tech.md` and `structure.md`.
- [ ] Optional: open the Agent Hooks panel to confirm the four hook files load in the IDE, and record the panel for the video.
- [ ] Optional: install the Context7 power from the Powers panel or [kiro.dev/powers](https://kiro.dev/powers/) if you want to try powers; tell me and I will record the result here.
