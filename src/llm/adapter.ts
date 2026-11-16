// The one way into LLM help (llm-adapter Req 1.2): the UI calls `assist`, and no other module
// talks to a provider. Provider "none" is the default (Req 1.1): the rule-based result comes
// back unchanged and nothing is sent anywhere. For a provider, `assistWithProvider` builds the
// request (labels and answers only), reads the reply defensively and merges it through the
// validators; the provider clients that `assist` will hand it come with task 6.

import type { Answer, FieldResult, FormModel, MappingResult } from '../form-model';
import type { IssueCode, ValidationContext } from '../validation';
import { collectNotes, mergeSuggestions } from './merge';
import { parseReply } from './parse';
import { buildRequest } from './prompt';
import type { LlmOutcome, LlmProvider, ProviderConfig } from './types';

/** LLM help starts off, so answers are mapped by the rule-based mapper only (Req 1.1). */
export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = Object.freeze({ id: 'none' });

/**
 * Offer LLM help on top of `ruleResult`, the rule-based mapping of `answers` onto `form`, which
 * the UI has already shown. With provider "none" the outcome is `off` with `ruleResult` itself,
 * whatever the signal says. `signal` is the user's Cancel button (Req 6.3) and `ctx` is the
 * validation context the merge step validates suggestions with (Req 5.1).
 *
 * Until the provider clients exist (task 6) any other provider is a programming error, because
 * the settings panel cannot offer one yet.
 */
export async function assist(
  config: ProviderConfig,
  _form: FormModel,
  _answers: readonly Answer[],
  ruleResult: MappingResult,
  _signal: AbortSignal,
  _ctx: ValidationContext,
): Promise<LlmOutcome> {
  if (config.id === 'none') return { kind: 'off', result: ruleResult };
  throw new Error(`LLM provider "${config.id}" is not available in this build`);
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
 * - `fallback` "bad-output" with `ruleResult`, when the reply is not the expected JSON.
 * - `ok` otherwise, with the merged result, the number of fields filled (`accepted`) and of
 *   suggestions that failed their validator (`rejected`), and the model's notes.
 *
 * `assist` will call this with the client for the configured provider (task 6), and the
 * property tests call it with a fake provider (P5). A rejection from `provider.complete` is
 * passed on for now; task 6 turns timeouts, network and HTTP errors into fallback reasons.
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
  const text = await provider.complete(buildRequest(form, answers), signal);
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
