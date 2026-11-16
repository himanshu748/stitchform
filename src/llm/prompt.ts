// What a provider receives (llm-adapter Req 3.2): field IDs, labels, types, required flags,
// choice options and the user's answer text, nothing else. Every object is built key by key,
// never by spreading a FormField or an Answer, so bounding boxes, pages, sources and any other
// property cannot slip in. The form image, signature images, stitch-code bytes and passphrases
// are not reachable from the arguments at all. Pure: no network, no storage, no logging.

import type { Answer, FormField, FormModel } from '../form-model';
import type { LlmRequest, LlmRequestAnswer, LlmRequestField } from './types';

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
