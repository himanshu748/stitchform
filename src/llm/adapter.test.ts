// Tests for the adapter with provider "none" (llm-adapter Req 1.1, 1.2, 1.4), including the
// FEAT-003 acceptance check that the whole typed, no-LLM path (rule-based mapping, validation,
// adapter) makes no network call: every network API a page script can use is replaced by a stub
// that records the call and throws. Also examples for assistWithProvider with a fake provider
// (Req 1.4, 5.1 to 5.5, and the fallbacks of Req 6.1 and 6.2); its property P5 is in
// merge.property.test.ts, and the Modal and Ollama client is tested in openai-compatible.test.ts.
// The form, answers, dates and replies are SAMPLE / DEMO DATA.

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Answer, FormField, FormModel } from '../form-model';
import { mapAnswers } from '../mapping';
import { mappingInputArb } from '../mapping/arbitraries';
import type { ValidationContext } from '../validation';
import { validationContextArb } from '../validation/arbitraries';
import { DEFAULT_PROVIDER_CONFIG, assist, assistWithProvider } from './adapter';
import * as publicApi from './index';
import { buildRequest } from './prompt';
import { ProviderError } from './provider-error';
import type { LlmProvider, LlmRequest, ProviderConfig } from './types';

const NETWORK_APIS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'] as const;
const networkCalls = vi.fn();

beforeEach(() => {
  for (const name of NETWORK_APIS) {
    vi.stubGlobal(
      name,
      vi.fn(function blocked() {
        networkCalls(name);
        throw new Error(`${name} was called in a no-LLM test`);
      }),
    );
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  networkCalls.mockReset();
});

const ctx: ValidationContext = { today: { y: 2026, m: 11, d: 16 }, lang: 'en' };

function field(id: string, label: string, type: FormField['type'], extra: Partial<FormField> = {}): FormField {
  return { id, label, type, required: true, bbox: { x: 0, y: 0, w: 0.5, h: 0.05 }, page: 0, ...extra };
}

const form: FormModel = {
  id: 'sample-hollowbrook-hostel',
  title: 'Hollowbrook Residential Hostel (fictional) (SAMPLE / DEMO DATA)',
  source: 'sample',
  pages: [{ index: 0, widthPt: 595.28, heightPt: 841.89 }],
  fields: [
    field('full-name', 'Full name', 'text'),
    field('city', 'City', 'text'),
    field('dob', 'Date of birth', 'date', { dateRole: 'dob' }),
    field('room-type', 'Room type', 'choice', { choices: ['Shared (demo)', 'Single (demo)'] }),
    field('emergency-contact-phone', 'Emergency contact phone', 'number'),
    field('photo', 'Photo', 'photo', { required: false }),
    field('signature', 'Signature', 'signature'),
  ],
};

const answers: Answer[] = [
  { text: 'Demo Applicant', source: 'typed', lang: 'en', promptedFieldId: 'full-name', seq: 0 },
  { text: 'नमूना नगर', source: 'voice', lang: 'hi', promptedFieldId: 'city', seq: 1 },
  { text: '31/02/2005', source: 'typed', lang: 'en', promptedFieldId: 'dob', seq: 2 },
  { text: 'room type single', source: 'voice', lang: 'en', seq: 3 },
];

describe('provider none (Req 1.1, 1.4)', () => {
  it('runs with stubs that do catch a network call', () => {
    expect(() => fetch('https://demo.invalid')).toThrow();
    expect(() => new XMLHttpRequest()).toThrow();
    expect(networkCalls.mock.calls).toEqual([['fetch'], ['XMLHttpRequest']]);
  });

  it('is the default, and the default cannot be changed in place', () => {
    expect(DEFAULT_PROVIDER_CONFIG).toEqual({ id: 'none' });
    expect(Object.isFrozen(DEFAULT_PROVIDER_CONFIG)).toBe(true);
  });

  it('maps and validates the demo answers with the rules alone, with no network call', async () => {
    const ruleResult = mapAnswers(form, answers, new Set(), ctx);
    const before = structuredClone(ruleResult);
    const outcome = await assist(DEFAULT_PROVIDER_CONFIG, form, answers, ruleResult, new AbortController().signal, ctx);

    expect(outcome).toEqual({ kind: 'off', result: before });
    expect(outcome.result).toBe(ruleResult);
    const { fields } = outcome.result;
    expect(fields['full-name']).toMatchObject({ status: 'filled', value: 'Demo Applicant', provenance: 'typed' });
    expect(fields.city).toMatchObject({ status: 'filled', value: 'नमूना नगर', provenance: 'voice' });
    expect(fields['room-type']).toMatchObject({ status: 'filled', value: 'Single (demo)', provenance: 'voice' });
    expect(fields.dob?.status).toBe('flagged');
    expect(fields.dob?.issues.map((i) => i.code)).toContain('date-impossible');
    expect(fields['emergency-contact-phone']?.issues.map((i) => i.code)).toEqual(['required-missing']);
    expect(fields.signature?.issues.map((i) => i.code)).toEqual(['signature-missing']);
    expect(networkCalls).not.toHaveBeenCalled();
  });

  it('for any form, answers, signatures and day, returns the rule-based result untouched and sends nothing', async () => {
    await fc.assert(
      fc.asyncProperty(mappingInputArb(), validationContextArb(), fc.boolean(), async ([f, a, signed], c, cancelled) => {
        const ruleResult = mapAnswers(f, a, signed, c);
        const before = structuredClone(ruleResult);
        // Turning LLM help off must keep the rule-based result even if a request was cancelled.
        const signal = cancelled ? AbortSignal.abort() : new AbortController().signal;
        const outcome = await assist({ id: 'none' }, f, a, ruleResult, signal, c);
        expect(outcome).toEqual({ kind: 'off', result: before });
        expect(outcome.result).toBe(ruleResult);
      }),
    );
    expect(networkCalls).not.toHaveBeenCalled();
  });
});

describe('one adapter (Req 1.2)', () => {
  it('exposes only assist, the default provider, the Ollama default and the endpoint check', () => {
    expect(Object.keys(publicApi).sort()).toEqual(['DEFAULT_OLLAMA_BASE_URL', 'DEFAULT_PROVIDER_CONFIG', 'assist', 'chatCompletionsUrl']);
  });

  it('refuses Gemini, which is not offered, and a configuration the settings panel should have caught, without sending anything or naming a key', async () => {
    const refused: [ProviderConfig, ErrorConstructor | RangeErrorConstructor, string][] = [
      [{ id: 'gemini', apiKey: 'demo-key', model: 'demo-model' }, Error, 'LLM provider "gemini" is not available in this build'],
      [{ id: 'modal', endpoint: 'http://demo.invalid', proxyToken: 'wk-demo.ws-demo' }, RangeError, 'The Modal endpoint is not an https URL Stitchform can use'],
      [{ id: 'modal', endpoint: 'https://demo.invalid', proxyToken: 'wk-demo ws-demo' }, RangeError, 'The Modal proxy token has characters a request header cannot hold'],
      [{ id: 'ollama', baseUrl: 'not a url', model: 'demo-model' }, RangeError, 'The Ollama base URL is not a URL Stitchform can use'],
      [{ id: 'ollama', baseUrl: 'http://localhost:11434/v1', model: '  ' }, RangeError, 'No Ollama model is chosen'],
    ];
    const ruleResult = mapAnswers(form, answers, new Set(), ctx);
    for (const [config, type, message] of refused) {
      const error = await assist(config, form, answers, ruleResult, new AbortController().signal, ctx).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(type);
      expect((error as Error).message).toBe(message);
    }
    expect(networkCalls).not.toHaveBeenCalled();
  });
});

/** A provider that records each request and resolves with `reply`, after running `during` if given. */
function fakeProvider(reply: string, during?: () => void): LlmProvider & { requests: LlmRequest[] } {
  const requests: LlmRequest[] = [];
  return {
    id: 'modal',
    requests,
    complete: (req) => {
      requests.push(req);
      during?.();
      return Promise.resolve(reply);
    },
  };
}

describe('assistWithProvider with a fake provider (Req 1.4, 5.1 to 5.5)', () => {
  const ruleResult = mapAnswers(form, answers, new Set(), ctx);
  const signal = (): AbortSignal => new AbortController().signal;

  it('sends labels and answers, merges the reply through the validators and returns counts and notes', async () => {
    const before = structuredClone(ruleResult);
    const reply = JSON.stringify({
      suggestions: [
        { fieldId: 'dob', value: '2005-08-14' },
        { fieldId: 'emergency-contact-phone', value: 'call the warden (demo)' },
        { fieldId: 'full-name', value: 'Other Demo Name' },
        { fieldId: 'signature', value: 'signed' },
        { fieldId: 'demo-not-on-form', value: 'Demo value' },
      ],
      warnings: [
        { fieldId: 'city', note: 'Check the spelling (demo).' },
        { fieldId: 'demo-not-on-form', note: 'Not on this form (demo).' },
      ],
    });
    const provider = fakeProvider(`\`\`\`json\n${reply}\n\`\`\``);
    const outcome = await assistWithProvider(provider, form, answers, ruleResult, signal(), ctx);

    expect(provider.requests).toEqual([buildRequest(form, answers)]);
    expect(ruleResult).toEqual(before);
    expect(outcome).toMatchObject({ kind: 'ok', accepted: 1, rejected: 1, notes: [{ fieldId: 'city', note: 'Check the spelling (demo).' }] });
    const { fields } = outcome.result;
    expect(fields.dob).toEqual({ fieldId: 'dob', status: 'filled', value: '14/08/2005', provenance: 'llm', issues: [{ fieldId: 'dob', code: 'llm-suggestion', severity: 'info' }] });
    expect(fields['emergency-contact-phone']?.issues.map((i) => i.code)).toEqual(['required-missing', 'llm-rejected']);
    expect(fields['full-name']).toEqual(ruleResult.fields['full-name']);
    expect(fields.signature).toEqual(ruleResult.fields.signature);
    expect(networkCalls).not.toHaveBeenCalled();
  });

  it('keeps the rule-based result as bad output when the reply is not the expected JSON', async () => {
    for (const reply of ['', 'Sorry, I cannot help with that.', '{"suggestions": [{"fieldId": "dob", "value": 14}]}', '{"suggestions": [']) {
      const outcome = await assistWithProvider(fakeProvider(reply), form, answers, ruleResult, signal(), ctx);
      expect(outcome).toEqual({ kind: 'fallback', result: ruleResult, reason: 'bad-output' });
      expect(outcome.result).toBe(ruleResult);
    }
  });

  it('treats a valid reply with nothing in it as ok, with nothing changed', async () => {
    const outcome = await assistWithProvider(fakeProvider('{"suggestions": [], "warnings": []}'), form, answers, ruleResult, signal(), ctx);
    expect(outcome).toEqual({ kind: 'ok', result: ruleResult, accepted: 0, rejected: 0, notes: [] });
  });

  it('does not call the provider when the signal is already cancelled', async () => {
    const provider = fakeProvider('{"suggestions": [{"fieldId": "dob", "value": "14/08/2005"}]}');
    const outcome = await assistWithProvider(provider, form, answers, ruleResult, AbortSignal.abort(), ctx);
    expect(outcome).toEqual({ kind: 'fallback', result: ruleResult, reason: 'cancelled' });
    expect(outcome.result).toBe(ruleResult);
    expect(provider.requests).toEqual([]);
  });

  it('merges nothing when the user cancels while the reply is on its way (Req 1.4)', async () => {
    const controller = new AbortController();
    const provider = fakeProvider('{"suggestions": [{"fieldId": "dob", "value": "14/08/2005"}]}', () => controller.abort());
    const outcome = await assistWithProvider(provider, form, answers, ruleResult, controller.signal, ctx);
    expect(outcome).toEqual({ kind: 'fallback', result: ruleResult, reason: 'cancelled' });
    expect(outcome.result).toBe(ruleResult);
    expect(provider.requests).toHaveLength(1);
  });

  it('turns a failed request into a fallback with the rule-based result (Req 6.1, 6.2)', async () => {
    const failing = (error: unknown): LlmProvider => ({ id: 'modal', complete: () => Promise.reject(error) });
    const cases: [ProviderError, Record<string, unknown>][] = [
      [new ProviderError('timeout'), { reason: 'timeout' }],
      [new ProviderError('network'), { reason: 'network' }],
      [new ProviderError('warming-up'), { reason: 'warming-up' }],
      [new ProviderError('bad-output'), { reason: 'bad-output' }],
      [new ProviderError('http', 401), { reason: 'http', status: 401 }],
      [new ProviderError('http', 500), { reason: 'http', status: 500 }],
    ];
    for (const [error, expected] of cases) {
      const outcome = await assistWithProvider(failing(error), form, answers, ruleResult, signal(), ctx);
      expect(outcome).toEqual({ kind: 'fallback', result: ruleResult, ...expected });
      expect(outcome.result).toBe(ruleResult);
    }
    // The user's cancel wins over whatever the provider rejected with.
    const controller = new AbortController();
    const cancelledThenFailed: LlmProvider = {
      id: 'modal',
      complete: () => {
        controller.abort();
        return Promise.reject(new ProviderError('network'));
      },
    };
    expect(await assistWithProvider(cancelledThenFailed, form, answers, ruleResult, controller.signal, ctx)).toEqual({ kind: 'fallback', result: ruleResult, reason: 'cancelled' });
  });

  it('passes on a rejection that is not a ProviderError, since that is a bug', async () => {
    const bug = new TypeError('demo bug');
    const provider: LlmProvider = { id: 'ollama', complete: () => Promise.reject(bug) };
    await expect(assistWithProvider(provider, form, answers, ruleResult, signal(), ctx)).rejects.toBe(bug);
  });
});
