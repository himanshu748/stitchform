# Tasks: LLM adapter and no-LLM fallback (F4)

Each task is one commit. No task deploys, serves or runs the Modal app.

- [x] 1. Add `src/llm/types.ts` and `adapter.ts` with provider `none` returning the rule-based result
  - _Requirements: 1.1, 1.2_

- [x] 2. Implement `buildRequest` (labels and answers only) with a unit test on the serialised keys
  - _Requirements: 3.2_

- [ ] 3. Implement `parseSuggestions` (defensive JSON extraction, caps) with unit tests
  - _Requirements: 5.5_

- [ ] 4. Implement `mergeSuggestions` with unit tests
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 5. Property test P5 (and P1 re-check) with a fake provider
  - `src/llm/merge.property.test.ts`
  - _Requirements: 5.1, 5.2, 5.3, 5.5; Property: P5, P1_

- [ ] 6. Implement the OpenAI-compatible client for Modal and Ollama with timeout, cancel and status handling, tested with a fake `fetch`
  - _Requirements: 2.1, 2.2, 3.3, 6.1, 6.2, 6.3_

- [ ] 7. Implement `key-store.ts` (memory default, optional remember, forget) with unit tests
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 8. LLM settings panel and first-use notice (in lab-ui): off by default, Modal preselected when turned on
  - _Requirements: 1.3, 1.4, 2.4, 3.1, 4.2_

- [ ] 9. Gate check for Gemini: confirm browser CORS and free-tier terms in official Google docs (Context7 or ai.google.dev). If confirmed, implement `gemini.ts` and show it; if not, record "not confirmed, left out" in README and KIRO_USAGE.md
  - _Requirements: 2.3_

- [ ] 10. Write `modal/stitchform_llm.py` per design.md; verify only with `python3 -m py_compile`; confirm the `--allowed-origins` value syntax from vLLM docs before writing it
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 11. README: Modal setup for the owner (deploy command, Proxy Token, allowed origins, cost note, payment method, budget and spend limit) and the Ollama `OLLAMA_ORIGINS` line
  - _Requirements: 2.2, 7.7_

- [ ] 12. After the owner says go and deploys: check `/health`, a CORS preflight with `curl -X OPTIONS`, and one request from the hosted app; record results and the owner's decision on the preflight question in KIRO_USAGE.md
  - _Requirements: 6.2, 7.4, 7.5_
