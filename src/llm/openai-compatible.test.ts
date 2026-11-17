// Tests for the OpenAI-compatible client used for Modal and Ollama (llm-adapter Req 2.1, 2.2,
// 3.3, 6.1 to 6.3), through `assist` as the app calls it. `fetch` is replaced by a fake that
// records each call and answers with a scripted Response, so no test reaches a real provider.
// The form, answers, endpoints, tokens and replies are SAMPLE / DEMO DATA.

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Answer, FormField, FormModel } from '../form-model';
import { mapAnswers } from '../mapping';
import { mappingInputArb } from '../mapping/arbitraries';
import type { ValidationContext } from '../validation';
import { anyStringArb, validationContextArb } from '../validation/arbitraries';
import { assist, assistWithProvider } from './adapter';
import {
  DEFAULT_OLLAMA_BASE_URL,
  MAX_RESPONSE_BYTES,
  MAX_TOKENS,
  MODAL_MODEL,
  REQUEST_TIMEOUT_MS,
  chatCompletionsUrl,
  modalProvider,
  ollamaProvider,
} from './openai-compatible';
import { REPLY_SCHEMA, SYSTEM_PROMPT, buildRequest } from './prompt';
import { parseReply } from './parse';
import { ProviderError } from './provider-error';
import type { LlmOutcome, LlmProvider, ProviderConfig } from './types';

interface Call {
  url: string;
  init: RequestInit;
}

let respond: (call: Call) => Promise<Response> | Response;
let calls: Call[];

beforeEach(() => {
  calls = [];
  respond = () => {
    throw new Error('no scripted response');
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const call = { url: String(url), init };
      calls.push(call);
      return respond(call);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A chat completion whose first choice holds `content`, as vLLM and Ollama send it. */
function completion(content: unknown, init: ResponseInit = {}): Response {
  const body = { id: 'demo-completion', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

/** A fetch that never answers and rejects with the signal's reason once the signal aborts, as fetch does. */
function waitForAbort({ init }: Call): Promise<Response> {
  return new Promise((_, reject) => {
    const signal = init.signal as AbortSignal;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

const ctx: ValidationContext = { today: { y: 2026, m: 11, d: 16 }, lang: 'en' };

function field(id: string, label: string, type: FormField['type'], extra: Partial<FormField> = {}): FormField {
  return { id, label, type, required: true, bbox: { x: 0, y: 0, w: 0.5, h: 0.05 }, page: 0, ...extra };
}

const form: FormModel = {
  id: 'sample-moonfield-scholarship',
  title: 'Moonfield Merit Scholarship Trust (fictional) (SAMPLE / DEMO DATA)',
  source: 'sample',
  pages: [{ index: 0, widthPt: 595.28, heightPt: 841.89 }],
  fields: [field('full-name', 'Full name', 'text'), field('dob', 'Date of birth', 'date', { dateRole: 'dob' }), field('signature', 'Signature', 'signature')],
};

const answers: Answer[] = [
  { text: 'Demo Scholar', source: 'typed', lang: 'en', promptedFieldId: 'full-name', seq: 0 },
  { text: 'born on fourteenth August two thousand five', source: 'voice', lang: 'en', seq: 1 },
];

const ruleResult = mapAnswers(form, answers, new Set(), ctx);
const TOKEN = 'wk-demo.ws-demo';
const MODAL_URL = 'https://demo--stitchform-llm-server.us-east.modal.direct';
const modal: ProviderConfig = { id: 'modal', endpoint: MODAL_URL, proxyToken: TOKEN };
const ollama: ProviderConfig = { id: 'ollama', baseUrl: DEFAULT_OLLAMA_BASE_URL, model: ' qwen3:4b ' };
const DOB_REPLY = '{"suggestions":[{"fieldId":"dob","value":"14/08/2005"}],"warnings":[]}';

const run = (config: ProviderConfig, signal: AbortSignal = new AbortController().signal): Promise<LlmOutcome> => assist(config, form, answers, ruleResult, signal, ctx);

const bodyOf = (call: Call | undefined): Record<string, unknown> => JSON.parse(String(call?.init.body)) as Record<string, unknown>;

describe('chatCompletionsUrl (Req 3.3)', () => {
  it('turns the base URL the user typed into its /v1/chat/completions URL', () => {
    const accepted: [string, string][] = [
      [MODAL_URL, `${MODAL_URL}/v1/chat/completions`],
      [` ${MODAL_URL}/ `, `${MODAL_URL}/v1/chat/completions`],
      [`${MODAL_URL}/v1`, `${MODAL_URL}/v1/chat/completions`],
      [`${MODAL_URL}/v1/`, `${MODAL_URL}/v1/chat/completions`],
      [`${MODAL_URL}/v1/chat/completions`, `${MODAL_URL}/v1/chat/completions`],
      [`${MODAL_URL}/v1/chat/completions/`, `${MODAL_URL}/v1/chat/completions`],
      ['https://Demo.Example.Invalid:8443/proxy/v1', 'https://demo.example.invalid:8443/proxy/v1/chat/completions'],
      [DEFAULT_OLLAMA_BASE_URL, 'http://localhost:11434/v1/chat/completions'],
      ['http://localhost:11434', 'http://localhost:11434/v1/chat/completions'],
      ['http://127.0.0.1:11434/v1', 'http://127.0.0.1:11434/v1/chat/completions'],
      ['http://[::1]:11434/v1', 'http://[::1]:11434/v1/chat/completions'],
      ['http://ollama.localhost:11434/v1', 'http://ollama.localhost:11434/v1/chat/completions'],
    ];
    for (const [base, url] of accepted) expect([base, chatCompletionsUrl(base)]).toEqual([base, url]);
  });

  it('refuses anything that is not https, or http to this device, and URLs with credentials, a query or a fragment', () => {
    const refused = [
      '',
      'not a url',
      'demo.modal.direct',
      'http://demo.modal.direct',
      'http://192.168.1.20:11434/v1',
      'http://localhost.demo.invalid:11434/v1',
      'http://127.0.0.1.demo.invalid/v1',
      'ftp://demo.invalid/v1',
      'file:///v1',
      'javascript:alert(1)',
      'https://demo:secret@demo.modal.direct',
      `${MODAL_URL}/v1?key=demo`,
      `${MODAL_URL}/v1#demo`,
    ];
    for (const base of refused) expect([base, chatCompletionsUrl(base)]).toEqual([base, null]);
  });
});

describe('Modal client (Req 2.1, 3.3)', () => {
  it('sends one POST to the configured endpoint with the token, the served model name, the reply schema and labels and answers only', async () => {
    respond = () => completion(DOB_REPLY);
    const outcome = await run(modal);

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(`${MODAL_URL}/v1/chat/completions`);
    expect(call?.init).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    expect(call?.init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` });
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
    expect(bodyOf(call)).toEqual({
      model: MODAL_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(buildRequest(form, answers)) },
      ],
      temperature: 0,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_schema', json_schema: { name: 'stitchform-suggestions', schema: REPLY_SCHEMA } },
    });

    expect(outcome).toMatchObject({ kind: 'ok', accepted: 1, rejected: 0, notes: [] });
    expect(outcome.result.fields.dob).toMatchObject({ status: 'filled', value: '14/08/2005', provenance: 'llm' });
    expect(outcome.result.fields['full-name']).toEqual(ruleResult.fields['full-name']);
  });

  it('sends no Authorization header without a token, and trims a pasted one', async () => {
    respond = () => completion(DOB_REPLY);
    await run({ id: 'modal', endpoint: MODAL_URL });
    await run({ id: 'modal', endpoint: MODAL_URL, proxyToken: '   ' });
    await run({ id: 'modal', endpoint: `${MODAL_URL}/`, proxyToken: ` ${TOKEN}\n` });
    expect(calls.map((c) => c.init.headers)).toEqual([
      { 'Content-Type': 'application/json' },
      { 'Content-Type': 'application/json' },
      { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    ]);
  });

  it('describes, in the system message, the reply shape that the schema and the parser expect', () => {
    expect(SYSTEM_PROMPT).toContain('{"suggestions":[{"fieldId":"...","value":"..."}],"warnings":[{"fieldId":"...","note":"..."}]}');
    expect(parseReply('{"suggestions":[{"fieldId":"...","value":"..."}],"warnings":[{"fieldId":"...","note":"..."}]}')).toEqual([
      { fieldId: '...', value: '...' },
      { fieldId: '...', note: '...' },
    ]);
    expect(SYSTEM_PROMPT).toContain('reply {"suggestions":[],"warnings":[]}');
    expect(parseReply('{"suggestions":[],"warnings":[]}')).toEqual([]);
    expect(REPLY_SCHEMA).toMatchObject({ required: ['suggestions', 'warnings'], properties: { suggestions: { items: { required: ['fieldId', 'value'] } }, warnings: { items: { required: ['fieldId', 'note'] } } } });
    expect(SYSTEM_PROMPT).toContain('DD/MM/YYYY');
    expect(SYSTEM_PROMPT).toContain('Never invent, guess or complete a value.');
    expect(SYSTEM_PROMPT).toContain('Never suggest a value for a signature or photo field.');
  });
});

describe('Ollama client (Req 2.2)', () => {
  it('sends the same messages to the local endpoint with the chosen model, no schema and no key', async () => {
    respond = () => completion(`Sure.\n\`\`\`json\n${DOB_REPLY}\n\`\`\``);
    const outcome = await run(ollama);
    expect(calls.map((c) => c.url)).toEqual(['http://localhost:11434/v1/chat/completions']);
    expect(calls[0]?.init.headers).toEqual({ 'Content-Type': 'application/json' });
    const body = bodyOf(calls[0]);
    expect(body).toEqual({
      model: 'qwen3:4b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(buildRequest(form, answers)) },
      ],
      temperature: 0,
      max_tokens: MAX_TOKENS,
    });
    expect(outcome).toMatchObject({ kind: 'ok', accepted: 1 });
  });
});

describe('failed requests keep the rule-based result (Req 6.1, 6.2)', () => {
  const fallback = (extra: Record<string, unknown>) => ({ kind: 'fallback', result: ruleResult, ...extra });

  it('reports a Modal 503 as warming up', async () => {
    respond = () => new Response('modal-http: no containers (demo)', { status: 503 });
    const outcome = await run(modal);
    expect(outcome).toEqual(fallback({ reason: 'warming-up' }));
    expect(outcome.result).toBe(ruleResult);
  });

  it('reports other HTTP errors, and 503 from Ollama, as "http" with the status', async () => {
    for (const status of [400, 401, 403, 404, 429, 500, 502]) {
      respond = () => new Response('demo error', { status });
      expect(await run(modal)).toEqual(fallback({ reason: 'http', status }));
    }
    respond = () => new Response('demo error', { status: 503 });
    expect(await run(ollama)).toEqual(fallback({ reason: 'http', status: 503 }));
  });

  it('reports a rejected fetch (network failure, CORS block or refused redirect) as "network"', async () => {
    for (const error of [new TypeError('Failed to fetch'), new DOMException('demo', 'NotAllowedError'), 'demo']) {
      respond = () => Promise.reject(error);
      expect(await run(modal)).toEqual(fallback({ reason: 'network' }));
      expect(await run(ollama)).toEqual(fallback({ reason: 'network' }));
    }
  });

  it('reports a body that is not a chat completion with string content as bad output', async () => {
    const bodies = ['', 'not json', '[]', '{}', '{"choices":[]}', '{"choices":{}}', '{"choices":[{"text":"demo"}]}', '{"choices":[{"message":{"content":null}}]}', '{"choices":[{"message":{"content":42}}]}'];
    for (const body of bodies) {
      respond = () => new Response(body, { status: 200 });
      expect([body, await run(modal)]).toEqual([body, fallback({ reason: 'bad-output' })]);
    }
    // Content that is not the expected JSON is bad output too, found by parseReply.
    respond = () => completion('I could not read this form.');
    expect(await run(ollama)).toEqual(fallback({ reason: 'bad-output' }));
  });

  it('reads at most MAX_RESPONSE_BYTES of a body', async () => {
    const atLimit = (n: number): string => {
      const json = JSON.stringify({ choices: [{ message: { content: DOB_REPLY } }] });
      return json + ' '.repeat(n - json.length);
    };
    respond = () => new Response(atLimit(MAX_RESPONSE_BYTES), { status: 200 });
    expect(await run(modal)).toMatchObject({ kind: 'ok', accepted: 1 });
    respond = () => new Response(atLimit(MAX_RESPONSE_BYTES + 1), { status: 200 });
    expect(await run(modal)).toEqual(fallback({ reason: 'bad-output' }));
    // A declared length over the limit is refused before reading.
    respond = () => new Response(DOB_REPLY, { status: 200, headers: { 'Content-Length': String(MAX_RESPONSE_BYTES + 1) } });
    expect(await run(modal)).toEqual(fallback({ reason: 'bad-output' }));
  });

  it('gives up after the timeout, which is 20 seconds in the app', async () => {
    expect(REQUEST_TIMEOUT_MS).toBe(20_000);
    respond = waitForAbort;
    const provider = modalProvider({ id: 'modal', endpoint: MODAL_URL }, 30);
    const outcome = await assistWithProvider(provider, form, answers, ruleResult, new AbortController().signal, ctx);
    expect(outcome).toEqual(fallback({ reason: 'timeout' }));
    const signal = calls[0]?.init.signal as AbortSignal;
    expect([signal.aborted, (signal.reason as DOMException).name]).toEqual([true, 'TimeoutError']);
    await expect(ollamaProvider({ id: 'ollama', baseUrl: DEFAULT_OLLAMA_BASE_URL, model: 'demo' }, 30).complete(buildRequest(form, answers), new AbortController().signal)).rejects.toEqual(
      new ProviderError('timeout'),
    );
  });
});

describe('cancel (Req 1.4, 6.3)', () => {
  it('aborts the request in flight when the user cancels, and merges nothing', async () => {
    respond = waitForAbort;
    const controller = new AbortController();
    const pending = run(modal, controller.signal);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();
    expect(await pending).toEqual({ kind: 'fallback', result: ruleResult, reason: 'cancelled' });
    expect((calls[0]?.init.signal as AbortSignal).aborted).toBe(true);
  });

  it('sends nothing when the signal is already cancelled', async () => {
    expect(await run(ollama, AbortSignal.abort())).toEqual({ kind: 'fallback', result: ruleResult, reason: 'cancelled' });
    expect(calls).toEqual([]);
  });
});

describe('privacy (Req 3.2, 4.3)', () => {
  it('rejects only with ProviderErrors that name no key, answer, endpoint or response body, and logs nothing', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    const echo = `echo ${TOKEN} ${answers.map((a) => a.text).join(' ')}`;
    const scripted: (() => Promise<Response> | Response)[] = [
      () => new Response(echo, { status: 401 }),
      () => new Response(echo, { status: 503 }),
      () => new Response(echo, { status: 200 }),
      () => Promise.reject(new TypeError(echo)),
    ];
    const provider: LlmProvider = modalProvider(modal as Extract<ProviderConfig, { id: 'modal' }>);
    for (const script of scripted) {
      respond = script;
      const error = await provider.complete(buildRequest(form, answers), new AbortController().signal).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      const message = (error as ProviderError).message;
      for (const secret of [TOKEN, 'modal.direct', 'echo', ...answers.map((a) => a.text)]) expect(message).not.toContain(secret);
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('assist through the client is the path P5 checks', () => {
  // P5 (merge.property.test.ts) drives assistWithProvider with a fake provider. For any text the
  // model returns, assist with a Modal or Ollama configuration and a fake fetch gives exactly the
  // same outcome, so P5 covers the code the app runs.
  const inputArb = mappingInputArb().chain(([f, a, signed]) => {
    const aimed = fc
      .array(fc.record({ fieldId: fc.constantFrom(...f.fields.map((x) => x.id)), value: fc.string() }), { maxLength: 6 })
      .map((suggestions) => JSON.stringify({ suggestions, warnings: [] }));
    return fc.tuple(fc.constant(f), fc.constant(a), fc.constant(signed), fc.oneof(fc.string(), anyStringArb(), fc.json(), aimed), fc.boolean());
  });

  it('gives the same outcome as a fake provider returning the same text', async () => {
    await fc.assert(
      fc.asyncProperty(inputArb, validationContextArb(), async ([f, a, signed, text, useModal], c) => {
        calls = [];
        respond = () => completion(text);
        const rules = mapAnswers(f, a, signed, c);
        const config: ProviderConfig = useModal ? modal : ollama;
        const viaClient = await assist(config, f, a, rules, new AbortController().signal, c);
        const fake: LlmProvider = { id: config.id === 'modal' ? 'modal' : 'ollama', complete: () => Promise.resolve(text) };
        const viaFake = await assistWithProvider(fake, f, a, rules, new AbortController().signal, c);
        expect(viaClient).toEqual(viaFake);
        expect(calls).toHaveLength(1);
        const messages = bodyOf(calls[0]).messages as { content: string }[];
        expect(messages[1]?.content).toBe(JSON.stringify(buildRequest(f, a)));
      }),
    );
  });
});
