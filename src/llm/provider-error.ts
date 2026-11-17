// How a provider client reports a failed request (llm-adapter Req 6.1, 6.2). `complete` rejects
// only with a ProviderError, and assistWithProvider turns it into a `fallback` outcome that keeps
// the rule-based result. The message names the reason and, for an HTTP error, the status, and
// nothing else: never the key, the answers, the endpoint or the response body (design.md
// "Error handling and fallback").

import type { FallbackReason } from './types';

export class ProviderError extends Error {
  readonly reason: FallbackReason;
  /** The HTTP status, only for reason "http". */
  readonly status: number | undefined;

  constructor(reason: FallbackReason, status?: number) {
    super(status === undefined ? `LLM request failed: ${reason}` : `LLM request failed: ${reason} (HTTP ${status})`);
    this.name = 'ProviderError';
    this.reason = reason;
    this.status = status;
  }
}
