# Design: Deliverable docs (F11)

Requirements: [requirements.md](requirements.md).

## Sources

| Fact | Source |
|---|---|
| Submission rules, bonus rules, write-up questions | [Kiroween 2026 rules](https://kiroween.devpost.com/rules), read in the in-app browser on 2026-11-15 (plain HTTP fetch returns 403); digest in PLAN.md section 2 |
| Kiro feature availability in CLI and IDE | [Kiro specs](https://kiro.dev/docs/specs/), [hooks](https://kiro.dev/docs/hooks/), [steering](https://kiro.dev/docs/steering/), [custom agents](https://kiro.dev/docs/custom-agents/), [MCP](https://kiro.dev/docs/mcp/configuration/), [powers](https://kiro.dev/docs/powers/) |
| Library versions and licences | `npm view`, recorded in each feature spec |
| Hosting | Vercel, only after the owner says go (PLAN.md section 12) |

The Devpost story headings in Req 3.1 follow the usual Devpost project template; before the story is final, task 4 checks them against the submission form the owner sees and adjusts.

No external API is used by this feature.

## Ownership of each document

| Document | Written by | Updated when | Owner action |
|---|---|---|---|
| README.md | agent | every feature that changes behaviour, commands or dependencies (doc-sync hook prompt) | review; replace URL placeholder after hosting |
| KIRO_USAGE.md | agent | every Kiro-related event (Req 2.2) | review; run the IDE-only steps listed there |
| DEVPOST_STORY.md | agent draft | milestone M9 | edit in own voice, paste into Devpost |
| VIDEO_SHOTLIST.md | agent draft | M9 | record and upload to YouTube |
| BLOG_DRAFT.md | agent draft | M9 | edit, publish on a third-party platform during the submission period |
| SOCIAL_POST.md | agent draft with TODO | M9 | fill TODO, post, link it in the form |
| SUBMISSION_CHECKLIST.md | agent | M9 and M10 | complete and submit |

## Honesty checks

- Every number in a doc must point to a command output, a log in `reports/raw/` or a measured run with device and date. The form-qa custom agent reviews the docs for unsupported claims before M10.
- Words like "fast", "accurate" or "secure" need a measurement or a cited mechanism next to them, or they are cut.
- Pre-existing work: commit-guard checks package names; fonts, word lists, language data and the T3 Code initial files are checked by the form-qa agent against `public/` contents.

## Video plan outline (detail in VIDEO_SHOTLIST.md)

| Time | Shot |
|---|---|
| 0:00 to 0:15 | Phone photo of a printed, crumpled sample form |
| 0:15 to 1:15 | Browser: OCR, check fields, typed and Hindi answers, seams lighting up, an issue caught (31/02) |
| 1:15 to 1:45 | Print PDF; stitch code made, page reloaded, QR scanned, form refilled |
| 1:45 to 2:30 | Kiro: specs folder, a hook blocking a bad commit, form-qa agent, a property test |
| 2:30 to 2:55 | Privacy panel and LLM off by default; close |

## Error handling

If a fact cannot be confirmed (for example a Devpost field name), the doc says "to confirm" next to it instead of guessing.

## Correctness properties

Not applicable: these are documents. P1 to P5 are owned by field-mapping (P1, P4), validation (P2), stitch-code (P3) and llm-adapter (P5); KIRO_USAGE.md reports their results.

## Testing

- commit-guard: no em dash in staged `.md` files, every npm dependency listed in README.
- A Vitest test checks that SOCIAL_POST.md starts with `#KiroweenHackathon26` and that BLOG_DRAFT.md contains "Kiroween 2026 hackathon".
- form-qa agent review of all seven docs before M10.
