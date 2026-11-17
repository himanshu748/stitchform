// One HTTP client for the two OpenAI-compatible providers (llm-adapter Req 2.1, 2.2, 3.3, 6.1
// to 6.3): the user's own Modal deployment (vLLM) and Ollama on the user's machine. Both take
// POST <base>/v1/chat/completions and answer with the model text at choices[0].message.content
// (Modal vLLM example; Ollama OpenAI compatibility docs).
//
// - The request goes only to the URL the user configured (Req 3.3): redirects are refused
//   (`redirect: "error"`, which makes fetch reject), no cookies are sent and nothing is cached.
// - A request is aborted after 20 seconds or when the user cancels, whichever comes first
//   (AbortSignal.timeout combined with the user's signal through AbortSignal.any).
// - fetch rejects only on a network failure, which includes a CORS block, and HTTP errors
//   resolve, so the status is checked. 503 from Modal is a cold start (Modal Servers guide).
// - The response is untrusted: at most MAX_RESPONSE_BYTES are read, and anything that is not a
//   chat completion with a string content counts as bad output.
// `complete` rejects only with a ProviderError, whose message never holds the key, the answers,
// the endpoint or the response body. Nothing here logs.

import { REPLY_SCHEMA, SYSTEM_PROMPT } from './prompt';
import { ProviderError } from './provider-error';
import type { LlmProvider, LlmRequest, ProviderConfig } from './types';

/** Requests are aborted after this long (Req 6.1). */
export const REQUEST_TIMEOUT_MS = 20_000;

/** The `--served-model-name` of the Modal app in modal/stitchform_llm.py. */
export const MODAL_MODEL = 'stitchform-llm';

/** The settings panel's default for Ollama (Req 2.2). */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1';

export const MAX_TOKENS = 512;

/** Most bytes of a response body read. A reply of 512 tokens is a few kilobytes. */
export const MAX_RESPONSE_BYTES = 256 * 1024;

const CHAT_PATH = '/chat/completions';

/**
 * A loopback host, which browsers treat as potentially trustworthy even over http (MDN "Secure
 * contexts"): localhost, a name ending in .localhost, 127.0.0.0/8 or ::1. The URL parser has
 * already lower-cased the name and written any IPv4 address as four decimal numbers.
 */
function isLoopbackHost(hostname: string): boolean {
  const h = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
  return h === 'localhost' || h.endsWith('.localhost') || h === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

/**
 * The chat completions URL for a base URL the user typed, or null if it cannot be used. The base
 * may be the server root, end in /v1, or be the full .../v1/chat/completions URL, with or without
 * a trailing slash, so "https://demo.modal.direct" and the Ollama default
 * "http://localhost:11434/v1" both work. It must be https, or http to a loopback host, so answers
 * never cross a network in clear text, and must have no user name, password, query or fragment.
 */
export function chatCompletionsUrl(base: string): string | null {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    return null;
  }
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname));
  if (!secure || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return null;
  let path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith(CHAT_PATH)) path = path.slice(0, -CHAT_PATH.length);
  if (!path.endsWith('/v1')) path += '/v1';
  return `${url.origin}${path}${CHAT_PATH}`;
}

interface ClientSettings {
  id: 'modal' | 'ollama';
  url: string;
  model: string;
  /** Sent as "Authorization: Bearer <bearer>"; null sends no Authorization header. */
  bearer: string | null;
  /** Send the reply schema as a vLLM structured output. */
  structured: boolean;
  timeoutMs: number;
}

function requestBody(settings: ClientSettings, req: LlmRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: settings.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(req) },
    ],
    temperature: 0,
    max_tokens: MAX_TOKENS,
  };
  if (settings.structured) {
    body.response_format = { type: 'json_schema', json_schema: { name: 'stitchform-suggestions', schema: REPLY_SCHEMA } };
  }
  return body;
}

/** Stop downloading a body that will not be read. */
function discard(response: Response): void {
  response.body?.cancel().catch(() => undefined);
}

/** The body as text, or bad output once it passes MAX_RESPONSE_BYTES. */
async function readCapped(response: Response): Promise<string> {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    discard(response);
    throw new ProviderError('bad-output');
  }
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      reader.cancel().catch(() => undefined);
      throw new ProviderError('bad-output');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** An own property of a plain object, or undefined. */
function own(o: unknown, key: string): unknown {
  return typeof o === 'object' && o !== null && !Array.isArray(o) && Object.hasOwn(o, key) ? (o as Record<string, unknown>)[key] : undefined;
}

/** The model text of a chat completion, choices[0].message.content. */
function replyText(body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ProviderError('bad-output');
  }
  const choices = own(parsed, 'choices');
  const content = own(own(Array.isArray(choices) ? choices[0] : undefined, 'message'), 'content');
  if (typeof content !== 'string') throw new ProviderError('bad-output');
  return content;
}

function client(settings: ClientSettings): LlmProvider {
  return {
    id: settings.id,
    async complete(req: LlmRequest, signal: AbortSignal): Promise<string> {
      if (signal.aborted) throw new ProviderError('cancelled');
      const timeout = AbortSignal.timeout(settings.timeoutMs);
      // A rejection from fetch or from reading the body: the user's cancel wins over the timeout,
      // and anything else is a network failure, a CORS block or a refused redirect, which a
      // script cannot tell apart.
      const failure = (): ProviderError =>
        new ProviderError(signal.aborted ? 'cancelled' : timeout.aborted ? 'timeout' : 'network');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.bearer !== null) headers.Authorization = `Bearer ${settings.bearer}`;

      let response: Response;
      try {
        response = await fetch(settings.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody(settings, req)),
          signal: AbortSignal.any([signal, timeout]),
          redirect: 'error',
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        });
      } catch {
        throw failure();
      }
      if (!response.ok) {
        // The body of an error response is not read: it may echo the request.
        discard(response);
        if (settings.id === 'modal' && response.status === 503) throw new ProviderError('warming-up');
        throw new ProviderError('http', response.status);
      }
      let body: string;
      try {
        body = await readCapped(response);
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw failure();
      }
      return replyText(body);
    },
  };
}

// Printable ASCII without spaces, so the token can go into a header as it is.
const HEADER_TOKEN = /^[\x21-\x7e]+$/;

/**
 * The client for the user's Modal deployment (Req 2.1). Sends model "stitchform-llm", the reply
 * schema as a vLLM structured output, and the Proxy Token, if one is given, as
 * "Authorization: Bearer <token-id>.<token-secret>" (Modal Proxy Tokens docs). Throws a
 * RangeError for an endpoint chatCompletionsUrl refuses or a token that cannot go into a header;
 * the settings panel checks both first. `timeoutMs` is for tests.
 */
export function modalProvider(config: Extract<ProviderConfig, { id: 'modal' }>, timeoutMs = REQUEST_TIMEOUT_MS): LlmProvider {
  const url = chatCompletionsUrl(config.endpoint);
  if (url === null) throw new RangeError('The Modal endpoint is not an https URL Stitchform can use');
  const token = config.proxyToken?.trim() ?? '';
  if (token !== '' && !HEADER_TOKEN.test(token)) throw new RangeError('The Modal proxy token has characters a request header cannot hold');
  return client({ id: 'modal', url, model: MODAL_MODEL, bearer: token === '' ? null : token, structured: true, timeoutMs });
}

/**
 * The client for Ollama (Req 2.2): the model the user chose, the same messages, no
 * `response_format` (the Ollama docs list the field but do not show the json_schema form) and no
 * key (Ollama ignores it). Throws a RangeError for a base URL chatCompletionsUrl refuses or a
 * blank model name. `timeoutMs` is for tests.
 */
export function ollamaProvider(config: Extract<ProviderConfig, { id: 'ollama' }>, timeoutMs = REQUEST_TIMEOUT_MS): LlmProvider {
  const url = chatCompletionsUrl(config.baseUrl);
  if (url === null) throw new RangeError('The Ollama base URL is not a URL Stitchform can use');
  const model = config.model.trim();
  if (model === '') throw new RangeError('No Ollama model is chosen');
  return client({ id: 'ollama', url, model, bearer: null, structured: false, timeoutMs });
}
