// The one way into LLM help (llm-adapter Req 1.2): the UI calls `assist`, and no other module
// talks to a provider. Provider "none" is the default (Req 1.1): the rule-based result comes
// back unchanged and nothing is sent anywhere. Request building (task 2), output parsing
// (task 3), merging (task 4) and the provider clients (task 6) plug in here.

import type { Answer, FormModel, MappingResult } from '../form-model';
import type { ValidationContext } from '../validation';
import type { LlmOutcome, ProviderConfig } from './types';

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
