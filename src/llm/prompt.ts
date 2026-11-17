// What a provider receives (llm-adapter Req 3.2): field IDs, labels, types, required flags,
// choice options and the user's answer text, nothing else. Every object is built key by key,
// never by spreading a FormField or an Answer, so bounding boxes, pages, sources and any other
// property cannot slip in. The form image, signature images, stitch-code bytes and passphrases
// are not reachable from the arguments at all. The fixed system message and the JSON Schema of
// the reply live here too. Pure: no network, no storage, no logging.

import type { Answer, FormField, FormModel } from '../form-model';
import type { LlmRequest, LlmRequestAnswer, LlmRequestField } from './types';

/**
 * The fixed system message (design.md "Prompt and output contract"): English, JSON only, dates
 * as DD/MM/YYYY, no invented values, no signatures. The user message is the LlmRequest as JSON.
 * Whatever the model does with it, parseReply and the validators decide what is used.
 */
export const SYSTEM_PROMPT = [
  'You help a person fill in a paper form.',
  'The user message is JSON with "fields" and "answers". Each field has an id, a label, a type, whether it is required and, for choice fields, its choices. Each answer is what the person typed or said, in the order given; "promptedFieldId" is the field the answer was given for, when known, and "lang" is "en" for English or "hi" for Hindi.',
  'Reply with JSON only, with no other text, in exactly this shape: {"suggestions":[{"fieldId":"...","value":"..."}],"warnings":[{"fieldId":"...","note":"..."}]}',
  'Suggest a value for a field only when an answer clearly gives it. Never invent, guess or complete a value.',
  'Use only field ids from "fields".',
  'Write every date as DD/MM/YYYY.',
  'For a choice field, the value must be one of its choices, copied exactly.',
  'Never suggest a value for a signature or photo field.',
  'Add a warning, in short plain English, for a likely mistake, such as an impossible date or an answer that seems to belong to a different field.',
  'If you have nothing to add, reply {"suggestions":[],"warnings":[]}.',
].join('\n');

const itemSchema = (textKey: 'value' | 'note') => ({
  type: 'object',
  properties: { fieldId: { type: 'string' }, [textKey]: { type: 'string' } },
  required: ['fieldId', textKey],
  additionalProperties: false,
});

/**
 * JSON Schema of the reply shape above, sent to vLLM (Modal) as
 * `response_format: { type: "json_schema", json_schema: { name, schema } }`.
 */
export const REPLY_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    suggestions: { type: 'array', items: itemSchema('value') },
    warnings: { type: 'array', items: itemSchema('note') },
  },
  required: ['suggestions', 'warnings'],
  additionalProperties: false,
});

function requestField(field: FormField): LlmRequestField {
  const out: LlmRequestField = { id: field.id, label: field.label, type: field.type, required: field.required };
  if (field.type === 'choice' && field.choices !== undefined) out.choices = [...field.choices];
  return out;
}

function requestAnswer(answer: Answer, fieldIds: ReadonlySet<string>): LlmRequestAnswer {
  const out: LlmRequestAnswer = { text: answer.text, lang: answer.lang };
  if (answer.promptedFieldId !== undefined && fieldIds.has(answer.promptedFieldId)) out.promptedFieldId = answer.promptedFieldId;
  return out;
}

/**
 * The request for `form` and `answers`. Fields keep form order, and choice options are copied.
 * Answers come in `seq` order, ties in input order, as the mapper takes them, so the provider
 * can tell which answer came last. `promptedFieldId` is kept only when it names a field of the
 * form; otherwise the answer goes as free text, which is how the mapper treats it too.
 */
export function buildRequest(form: FormModel, answers: readonly Answer[]): LlmRequest {
  const fieldIds = new Set(form.fields.map((f) => f.id));
  // Array.prototype.sort is stable, so answers with the same seq keep their input order.
  const ordered = [...answers].sort((x, y) => x.seq - y.seq);
  return {
    fields: form.fields.map(requestField),
    answers: ordered.map((a) => requestAnswer(a, fieldIds)),
  };
}
