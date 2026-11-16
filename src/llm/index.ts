// Public API of the llm module. The UI imports only from here, and only `assist` can send
// anything to a provider (Req 1.2).

export type { FallbackReason, LlmOutcome, ProviderConfig, ProviderId } from './types';
export { DEFAULT_PROVIDER_CONFIG, assist } from './adapter';
