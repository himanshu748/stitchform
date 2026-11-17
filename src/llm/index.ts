// Public API of the llm module. The UI imports only from here, and only `assist` can send
// anything to a provider (Req 1.2).

export type { FallbackReason, LlmNote, LlmOutcome, ProviderConfig, ProviderId } from './types';
export { DEFAULT_PROVIDER_CONFIG, assist } from './adapter';
export { DEFAULT_OLLAMA_BASE_URL, chatCompletionsUrl } from './openai-compatible';
export type { KeyProvider } from './key-store';
export { forgetKey, getKey, isRemembered, setKey } from './key-store';
