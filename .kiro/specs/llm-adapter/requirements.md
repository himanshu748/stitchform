# Requirements: LLM adapter and no-LLM fallback (F4)

Feature F4 in PLAN.md section 5. Judging criterion: Innovation/Idea.

## Introduction

LLM help is optional and off by default. Rule-based mapping (field-mapping spec) is the default and always works, so judges can test every feature without an account, a key or a network call. When the user turns LLM help on, one adapter talks to one provider at a time. Modal is preselected: an open-weights model that the user deploys on Modal's Starter plan free credits. Ollama (local) is the second provider. Gemini's free tier is optional and is only offered if browser access and terms are confirmed. LLM output is a suggestion: it passes the same validators as typed input and never replaces what the user entered.

## Glossary

- **Provider**: `none` (default, rule-based only), `modal`, `ollama` or `gemini`.
- **Suggestion**: a field ID and a value proposed by the LLM, or a note about a possible mistake.
- **Cold start**: a Modal Server with no running container answers HTTP 503 while a container starts.

## Requirements

### Requirement 1: Off by default, one adapter

1.1 THE SYSTEM SHALL start with provider `none` and map answers with the rule-based mapper only.

1.2 THE SYSTEM SHALL route every LLM request through one adapter interface, and no other module SHALL call a provider directly.

1.3 WHEN the user turns LLM help on THE SYSTEM SHALL preselect provider `modal` and let the user switch to `ollama`, or to `gemini` where it is offered.

1.4 WHEN the user turns LLM help off THE SYSTEM SHALL stop sending requests immediately and keep the current rule-based result.

### Requirement 2: Provider settings

2.1 WHERE the provider is `modal` THE SYSTEM SHALL ask for the endpoint URL of the user's own deployment and an optional key (a Modal Proxy Token, sent as `Authorization: Bearer <token-id>.<token-secret>`).

2.2 WHERE the provider is `ollama` THE SYSTEM SHALL default the base URL to `http://localhost:11434/v1` and ask for the model name, and SHALL show the `OLLAMA_ORIGINS` setup line from README when a request is blocked by CORS.

2.3 WHERE the provider is `gemini` THE SYSTEM SHALL ask for the user's own API key; the provider SHALL be offered only after a task confirms in official docs that the Gemini REST API accepts browser requests and that the free tier terms allow this use.

2.4 THE SYSTEM SHALL ship no API key, endpoint secret or default Modal URL in the code or the build.

### Requirement 3: What is sent

3.1 WHEN LLM help is turned on THE SYSTEM SHALL show, before the first request, a notice naming the provider and the endpoint host that will receive field labels and answers, and SHALL send nothing until the user confirms.

3.2 THE SYSTEM SHALL send field IDs, labels, types, choice options, required flags and the user's answer text only, and SHALL NOT send the form image, signature images, bounding boxes, stitch-code bytes or passphrases.

3.3 THE SYSTEM SHALL send each request only to the URL the user configured.

### Requirement 4: Key handling

4.1 THE SYSTEM SHALL keep a user-entered key in memory only by default, so that it is gone when the tab closes.

4.2 IF the user ticks "remember this key on this device" THEN THE SYSTEM SHALL store it in `localStorage`, show a warning that any script running on the page could read it, and show a "forget key" button that deletes it.

4.3 THE SYSTEM SHALL NOT log keys or include them in a stitch code, an error message or a PDF.

### Requirement 5: LLM output is only a suggestion

5.1 WHEN the provider returns suggestions THE SYSTEM SHALL validate each suggested value with the same validator used for typed input.

5.2 IF a suggested value fails its validator, or names a field that does not exist THEN THE SYSTEM SHALL NOT mark any field `filled` with it, and SHALL add an `llm-rejected` info issue where a field exists.

5.3 THE SYSTEM SHALL NOT replace a value the user typed, spoke or loaded from a stitch code; suggestions may only fill fields that are `empty` or `flagged`, or add warnings.

5.4 WHEN a suggestion fills a field THE SYSTEM SHALL mark it with provenance `llm` and an `llm-suggestion` issue so the user reviews it before printing.

5.5 THE SYSTEM SHALL parse provider output defensively: any output that is not the expected JSON SHALL be treated as no suggestions.

### Requirement 6: Fallback to rule-based mapping

6.1 IF a request fails, times out after 20 seconds, is blocked by CORS, or returns an HTTP error THEN THE SYSTEM SHALL keep the rule-based result and show a short message naming what failed.

6.2 IF the Modal endpoint returns HTTP 503 THEN THE SYSTEM SHALL show "The model is warming up. Your form still works without it." and offer a "try again" button.

6.3 WHILE a request is in flight THE SYSTEM SHALL keep the form usable and let the user cancel the request.

### Requirement 7: The Modal app

**User story:** As the project owner, I want a small, cheap model I deploy myself, so that LLM help costs nothing beyond Modal's monthly free credits and no third-party API holds the answers.

#### Acceptance criteria

7.1 THE SYSTEM SHALL include `modal/stitchform_llm.py`, a Modal app that serves an open-weights instruct model through vLLM's OpenAI-compatible server using `@app.server`.

7.2 THE SYSTEM SHALL use a model with a permissive licence that fits one small GPU, with the model revision pinned.

7.3 THE SYSTEM SHALL configure a short `scaledown_window` and a single container, so that idle time is not billed beyond that window.

7.4 THE SYSTEM SHALL restrict browser CORS to the app's own origin(s) and `http://localhost:5173` and `http://localhost:4173`, read from configuration rather than hard-coded.

7.5 THE SYSTEM SHALL require Modal proxy authentication by default; any change to public access SHALL be a documented decision by the project owner.

7.6 THE SYSTEM SHALL NOT be deployed, served or run by the coding agent; deployment happens only after the project owner says go, and commit-guard blocks `modal deploy`, `modal serve` and `modal run` until then.

7.7 THE SYSTEM SHALL document in README the cost per GPU-second from Modal's pricing page, the $30 monthly Starter credit, that Modal requires a payment method on file, and how to set a workspace budget or spend limit.
