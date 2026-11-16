// Plaintext of a stitch code (stitch-code Req 3.1, 3.2, 5.1, 5.2): UTF-8 JSON
// {"v":1,"f":"<formId>","a":[["<fieldId>","<text>"], ...]}. It holds only the form ID and, per
// field, the text the user entered, taken from toPromptedAnswers. Signature fields never become
// text there, and images, API keys and the passphrase have no place in this shape (Req 3.2).
// Pure: no I/O, no logging.

import type { Answer, MappingResult } from '../form-model';
import { toPromptedAnswers } from '../mapping';
import type { Bytes } from './format';

export const PAYLOAD_VERSION = 1;

/** One field's answer: field ID and the text entered for it. */
export type StitchAnswer = readonly [fieldId: string, text: string];

export interface StitchPayload {
  formId: string;
  answers: StitchAnswer[];
}

export type PayloadResult = { ok: true; payload: StitchPayload } | { ok: false; code: 'bad-payload' };

const utf8 = new TextEncoder();
const DEVANAGARI = /[\u0900-\u097f]/u;

/** The form ID and per-field text of a mapping result, in field order (Req 3.1, 3.2). */
export function payloadFromResult(result: MappingResult): StitchPayload {
  const answers = toPromptedAnswers(result).flatMap((a): StitchAnswer[] =>
    a.promptedFieldId === undefined ? [] : [[a.promptedFieldId, a.text]],
  );
  return { formId: result.formId, answers };
}

/**
 * Serialise to UTF-8 JSON. JSON.stringify escapes lone surrogate halves, so the bytes are always
 * valid UTF-8 and any JS string comes back unchanged.
 */
export function toPayload(formId: string, answers: readonly StitchAnswer[]): Bytes {
  return utf8.encode(JSON.stringify({ v: PAYLOAD_VERSION, f: formId, a: answers }));
}

const isString = (x: unknown): x is string => typeof x === 'string';

function isStitchAnswer(x: unknown): x is StitchAnswer {
  return Array.isArray(x) && x.length === 2 && isString(x[0]) && isString(x[1]);
}

/**
 * Parse and check decrypted, decompressed bytes. Anything but valid UTF-8 JSON of exactly the
 * version 1 shape gives "bad-payload", which the caller reports like a wrong passphrase, with no
 * partial data (Req 5.2).
 */
export function fromPayload(bytes: Uint8Array): PayloadResult {
  const bad: PayloadResult = { ok: false, code: 'bad-payload' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return bad;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return bad;
  const keys = Object.keys(parsed).sort();
  if (keys.length !== 3 || keys[0] !== 'a' || keys[1] !== 'f' || keys[2] !== 'v') return bad;
  const { v, f, a } = parsed as { v: unknown; f: unknown; a: unknown };
  if (v !== PAYLOAD_VERSION || !isString(f) || !Array.isArray(a) || !a.every(isStitchAnswer)) return bad;
  return { ok: true, payload: { formId: f, answers: a.map(([id, text]) => [id, text] as const) } };
}

/**
 * Prompted answers for the mapper, one per stored answer in stored order (Req 5.1). `source` is
 * "stitch-code"; `lang` is "hi" when the text contains Devanagari script, as in toPromptedAnswers.
 */
export function toAnswers(payload: StitchPayload): Answer[] {
  return payload.answers.map(([fieldId, text], seq) => ({
    text,
    source: 'stitch-code',
    lang: DEVANAGARI.test(text) ? 'hi' : 'en',
    promptedFieldId: fieldId,
    seq,
  }));
}
