// Defensive reading of model output (llm-adapter Req 5.5, design.md "Prompt and output
// contract"). The model is asked to reply with JSON only,
// {"suggestions":[{"fieldId":"...","value":"..."}],"warnings":[{"fieldId":"...","note":"..."}]},
// but a reply may wrap it in prose or a code fence, stop halfway, or be anything at all. The
// first JSON object in the reply is checked with hand-written guards (JSON.parse, no eval), and
// a reply that is not the expected shape counts as no suggestions. Pure and total: no network,
// no storage, no logging, never throws.

import type { LlmSuggestion } from './types';

/** Most items (suggestions and warnings together) taken from one reply; later ones are ignored. */
export const MAX_SUGGESTIONS = 100;

/**
 * Longest value or note accepted, in UTF-16 code units like the validators' input limit. A
 * longer item is dropped, never cut: a cut value could still pass its validator (a cut name is
 * still text) and would then be a value nobody suggested.
 */
export const MAX_SUGGESTION_LENGTH = 200;

/**
 * The first JSON object in `text`: from the first "{" to the "}" that closes it, skipping braces
 * inside JSON strings. Null when there is no "{" or it is never closed (a reply that stopped
 * halfway). Only the first "{" is tried, so the scan is one pass over the text.
 */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === '{') {
      depth += 1;
    } else if (c === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

type JsonObject = Record<string, unknown>;

const isObject = (x: unknown): x is JsonObject => typeof x === 'object' && x !== null && !Array.isArray(x);

/** An own property only, so nothing is ever read from the prototype chain. */
const own = (o: JsonObject, key: string): unknown => (Object.hasOwn(o, key) ? o[key] : undefined);

interface Item {
  fieldId: string;
  text: string;
}

/**
 * The list under `key` as field ID and text pairs, where the text is the `textKey` property.
 * A missing list is empty; anything else that is not a list of objects with a string `fieldId`
 * and a string `textKey` is a mismatch (null). Other keys in an item are ignored.
 */
function readList(o: JsonObject, key: 'suggestions' | 'warnings', textKey: 'value' | 'note'): Item[] | null {
  const list = own(o, key);
  if (list === undefined) return [];
  if (!Array.isArray(list)) return null;
  const out: Item[] = [];
  for (const item of list) {
    if (!isObject(item)) return null;
    const fieldId = own(item, 'fieldId');
    const text = own(item, textKey);
    if (typeof fieldId !== 'string' || typeof text !== 'string') return null;
    out.push({ fieldId, text });
  }
  return out;
}

/**
 * Read a reply. Null when it is not the expected JSON: no complete JSON object, an object with
 * neither `suggestions` nor `warnings`, or either of them not of the expected shape. Otherwise
 * the suggestions (`{ fieldId, value }`) in reply order, then the warnings (`{ fieldId, note }`)
 * in reply order, each a new object with only those keys. Items whose value or note is longer
 * than MAX_SUGGESTION_LENGTH are dropped, and at most MAX_SUGGESTIONS items are kept. A valid
 * reply with nothing in it gives [], so the adapter can tell it apart from bad output.
 */
export function parseReply(text: string): LlmSuggestion[] | null {
  if (typeof text !== 'string') return null;
  const json = firstJsonObject(text);
  if (json === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(parsed) || (!Object.hasOwn(parsed, 'suggestions') && !Object.hasOwn(parsed, 'warnings'))) return null;
  const values = readList(parsed, 'suggestions', 'value');
  const notes = readList(parsed, 'warnings', 'note');
  if (values === null || notes === null) return null;

  const out: LlmSuggestion[] = [];
  for (const { fieldId, text: value } of values) if (value.length <= MAX_SUGGESTION_LENGTH) out.push({ fieldId, value });
  for (const { fieldId, text: note } of notes) if (note.length <= MAX_SUGGESTION_LENGTH) out.push({ fieldId, note });
  return out.slice(0, MAX_SUGGESTIONS);
}

/** The suggestions and warnings in a reply, or [] for any reply that is not the expected JSON (Req 5.5). */
export function parseSuggestions(text: string): LlmSuggestion[] {
  return parseReply(text) ?? [];
}
