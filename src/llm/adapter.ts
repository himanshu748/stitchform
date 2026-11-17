// The one way into LLM help (llm-adapter Req 1.2): the UI calls `assist`, and no other module
// talks to a provider. Provider "none" is the default (Req 1.1): the rule-based result comes
// back unchanged and nothing is sent anywhere. For Modal or Ollama, `assist` builds the
// OpenAI-compatible client and hands it to `assistWithProvider`, which builds the request
// (labels and answers only), reads the reply defensively, merges it through the validators and
// turns a failed request into a fallback that keeps the rule-based result (Req 6.1, 6.2).

import type { Answer, FieldResult, FormModel, MappingResult } from '../form-model';
import type { IssueCode, ValidationContext } from '../validation';
import { collectNotes, mergeSuggestions } from './merge';
import { modalProvider, ollamaProvider } from './openai-compatible';
import { parseReply } from './parse';
import { buildRequest } from './prompt';
import { ProviderError } from './provider-error';
import type { LlmOutcome, LlmProvider, ProviderConfig } from './types';

/** LLM help starts off, so answers are mapped by the rule-based mapper only (Req 1.1). */
export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = Object.freeze({ id: 'none' });

/** The client for a configured provider. Gemini is not offered in this build (task 9). */
function providerFor(config: Exclude<ProviderConfig, { id: 'none' }>): LlmProvider {
  switch (config.id) {
    case 'modal':
      return modalProvider(config);
    case 'ollama':
      return ollamaProvider(config);
    case 'gemini':
      throw new Error(`LLM provider "${config.id}" is not available in this build`);
  }
}

/**
 * Offer LLM help on top of `ruleResult`, the rule-based mapping of `answers` onto `form`, which
 * the UI has already shown. With provider "none" the outcome is `off` with `ruleResult` itself,
 * whatever the signal says. Otherwise the request goes to the configured Modal or Ollama
 * endpoint through `assistWithProvider`. `signal` is the user's Cancel button (Req 6.3) and
 * `ctx` is the validation context the merge step validates suggestions with (Req 5.1).
 *
 * Rejects with a RangeError, before sending anything, for a configuration the settings panel
 * should not have let through (an endpoint `chatCompletionsUrl` refuses, a Modal token a header
 * cannot hold, a blank Ollama model), and with an Error for provider "gemini", which is not
 * offered. Every failure of the request itself resolves to a `fallback` outcome.
 */
export async function assist(
  config: ProviderConfig,
  form: FormModel,
  answers: readonly Answer[],
  ruleResult: MappingResult,
  signal: AbortSignal,
  ctx: ValidationContext,
): Promise<LlmOutcome> {
  if (config.id === 'none') return { kind: 'off', result: ruleResult };
  return assistWithProvider(providerFor(config), form, answers, ruleResult, signal, ctx);
}

const issueCount = (r: FieldResult | undefined, code: IssueCode): number => r?.issues.filter((i) => i.code === code).length ?? 0;

/** How many `code` issues `after` has that `before` did not, over all fields. */
function addedIssues(before: MappingResult, after: MappingResult, code: IssueCode): number {
  let n = 0;
  for (const [id, r] of Object.entries(after.fields)) {
    const old = Object.hasOwn(before.fields, id) ? before.fields[id] : undefined;
    n += Math.max(0, issueCount(r, code) - issueCount(old, code));
  }
  return n;
}

/**
 * The provider-independent part of LLM help. Sends `buildRequest(form, answers)` to `provider`,
 * reads the reply with `parseReply` and merges it into `ruleResult` with `mergeSuggestions`, so
 * no field is filled with a value that fails its validator and no value the user entered is
 * replaced (Req 5.1 to 5.5). Outcomes:
 * - `fallback` "cancelled" with `ruleResult`, when `signal` is cancelled before the request or
 *   while the reply is on its way (Req 1.4); nothing is merged, and the provider is not called
 *   when the signal was cancelled first.
 * - `fallback` with the ProviderError's reason (and HTTP status, for "http") and `ruleResult`,
 *   when the request fails: timeout, network or CORS, HTTP error, Modal warming up, or a
 *   response that is not a chat completion (Req 6.1, 6.2).
 * - `fallback` "bad-output" with `ruleResult`, when the reply is not the expected JSON.
 * - `ok` otherwise, with the merged result, the number of fields filled (`accepted`) and of
 *   suggestions that failed their validator (`rejected`), and the model's notes.
 *
 * `assist` calls this with the client for the configured provider, and the property tests call
 * it with a fake provider (P5). A rejection that is not a ProviderError is a bug and is passed on.
 */
export async function assistWithProvider(
  provider: LlmProvider,
  form: FormModel,
  answers: readonly Answer[],
  ruleResult: MappingResult,
  signal: AbortSignal,
  ctx: ValidationContext,
): Promise<LlmOutcome> {
  if (signal.aborted) return { kind: 'fallback', result: ruleResult, reason: 'cancelled' };
  let text: string;
  try {
    text = await provider.complete(buildRequest(form, answers), signal);
  } catch (error) {
    if (signal.aborted) return { kind: 'fallback', result: ruleResult, reason: 'cancelled' };
    if (!(error instanceof ProviderError)) throw error;
    const { reason, status } = error;
    return status === undefined ? { kind: 'fallback', result: ruleResult, reason } : { kind: 'fallback', result: ruleResult, reason, status };
  }
  if (signal.aborted) return { kind: 'fallback', result: ruleResult, reason: 'cancelled' };
  const suggestions = parseReply(text);
  if (suggestions === null) return { kind: 'fallback', result: ruleResult, reason: 'bad-output' };
  const result = mergeSuggestions(form, ruleResult, suggestions, ctx);
  return {
    kind: 'ok',
    result,
    accepted: addedIssues(ruleResult, result, 'llm-suggestion'),
    rejected: addedIssues(ruleResult, result, 'llm-rejected'),
    notes: collectNotes(form, suggestions),
  };
}
