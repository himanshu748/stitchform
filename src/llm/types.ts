// Types of the single LLM adapter (llm-adapter spec, design.md "Types"). LLM help is optional
// and off by default: provider "none" maps answers with the rule-based mapper only (Req 1.1).

import type { FieldType, MappingResult } from '../form-model';

export type ProviderId = 'none' | 'modal' | 'ollama' | 'gemini';

export type ProviderConfig =
  | { id: 'none' }
  // The user's own Modal deployment. The optional Proxy Token is sent as
  // "Authorization: Bearer <token-id>.<token-secret>" (Req 2.1).
  | { id: 'modal'; endpoint: string; proxyToken?: string }
  // Ollama on the user's machine; the settings panel defaults baseUrl to http://localhost:11434/v1 (Req 2.2).
  | { id: 'ollama'; baseUrl: string; model: string }
  // Offered only if llm-adapter task 9 confirms browser access and the free-tier terms (Req 2.3).
  | { id: 'gemini'; apiKey: string; model: string };

/** One form field as a provider sees it: no bounding box, page, date role or anything else (Req 3.2). */
export interface LlmRequestField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Only for choice fields. */
  choices?: string[];
}

/** One answer as a provider sees it: the text, the field it was prompted for, and its language (Req 3.2). */
export interface LlmRequestAnswer {
  text: string;
  promptedFieldId?: string;
  lang: 'en' | 'hi';
}

/**
 * Everything a provider receives. It has no place for the form image, signature images,
 * bounding boxes, stitch-code bytes or passphrases, so Req 3.2 holds by construction.
 */
export interface LlmRequest {
  fields: LlmRequestField[];
  answers: LlmRequestAnswer[];
}

/** One item of model output: a value proposed for a field, or a note about a possible mistake. */
export interface LlmSuggestion {
  fieldId: string;
  value?: string;
  note?: string;
}

/**
 * A model's note about a possible mistake in one field of the form (Req 5.3). It is model text
 * and may quote an answer, so it is kept out of issues, stitch codes and PDFs, is never logged,
 * and is shown with textContent only.
 */
export interface LlmNote {
  fieldId: string;
  note: string;
}

/** A provider client. Only adapter.ts calls one (Req 1.2). */
export interface LlmProvider {
  readonly id: Exclude<ProviderId, 'none'>;
  /** Resolves to the raw model text. */
  complete(req: LlmRequest, signal: AbortSignal): Promise<string>;
}

/** Why the rule-based result was kept although a provider was configured (Req 6.1, 6.2). */
export type FallbackReason = 'timeout' | 'network' | 'http' | 'warming-up' | 'bad-output' | 'cancelled';

/** What `assist` returns. Every outcome carries a complete mapping result the UI can show. */
export type LlmOutcome =
  | { kind: 'off'; result: MappingResult }
  | { kind: 'ok'; result: MappingResult; accepted: number; rejected: number }
  | { kind: 'fallback'; result: MappingResult; reason: FallbackReason };
