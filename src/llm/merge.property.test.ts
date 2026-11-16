// LLM output properties (llm-adapter spec, design.md "Correctness properties").
// P5 (llm-adapter Req 5.1, 5.2, 5.3, 5.5): for any string a fake provider returns (fc.string(),
// any string at all, JSON text built from fc.record objects with field IDs of the form, IDs it
// does not have and random IDs, with valid, invalid and random values, the same inside a code
// fence or cut off anywhere, and JSON of the wrong shape), assistWithProvider never rejects,
// never leaves a field filled with a value that fails validateField, and never changes a field
// filled from a typed, spoken or stitch-code answer, a signature field or a photo field.
// P1 re-check (field-mapping Req 5.1, validation Req 4.1): after the merge every required field
// is still filled with a valid value or flagged with an error, also when the merge gets any
// list of suggestions directly and a rule-based result with entries missing.
// The provider is a fake that returns the generated string; nothing is sent anywhere. Forms,
// answers and replies are generated demo data (SAMPLE / DEMO DATA).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AnswerSource, FieldResult, FormField, FormModel, MappingResult } from '../form-model';
import { mapAnswers } from '../mapping';
import { ID_NOT_ON_FORM, mappingInputArb } from '../mapping/arbitraries';
import { normaliseText, validateField, type ValidationContext } from '../validation';
import { anyStringArb, rawForFieldArb, validationContextArb } from '../validation/arbitraries';
import { assistWithProvider } from './adapter';
import { mergeSuggestions } from './merge';
import { parseReply } from './parse';
import { buildRequest } from './prompt';
import type { LlmOutcome, LlmProvider, LlmRequest, LlmSuggestion } from './types';

/** Answer sources whose filled values a suggestion must never replace (Req 5.3). */
const USER_SOURCES: ReadonlySet<AnswerSource | undefined> = new Set(['typed', 'voice', 'stitch-code']);

const isProtected = (field: FormField, was: FieldResult): boolean =>
  field.type === 'signature' || field.type === 'photo' || (was.status === 'filled' && USER_SOURCES.has(was.provenance));

const hasError = (r: FieldResult): boolean => r.issues.some((i) => i.severity === 'error');

const llmIssue = (fieldId: string, code: 'llm-suggestion' | 'llm-rejected') => ({ fieldId, code, severity: 'info' });

/** A provider that records each request and resolves with `reply`. */
function fakeProvider(reply: string): LlmProvider & { requests: LlmRequest[] } {
  const requests: LlmRequest[] = [];
  return {
    id: 'modal',
    requests,
    complete: (req) => {
      requests.push(req);
      return Promise.resolve(reply);
    },
  };
}

function fieldIdArb(form: FormModel): fc.Arbitrary<string> {
  return fc.oneof(
    { weight: 4, arbitrary: fc.constantFrom(...form.fields.map((f) => f.id)) },
    { weight: 1, arbitrary: fc.constant(ID_NOT_ON_FORM) },
    { weight: 1, arbitrary: fc.string({ maxLength: 12 }) },
  );
}

/** Suggestions as objects: values aimed at a field (valid, invalid or random for its type) or random. */
function suggestionArb(form: FormModel): fc.Arbitrary<{ fieldId: string; value: string }> {
  const aimed = fc.constantFrom(...form.fields).chain((f) => rawForFieldArb(f).map((value) => ({ fieldId: f.id, value })));
  const random = fc.record({ fieldId: fieldIdArb(form), value: anyStringArb() });
  return fc.oneof({ weight: 3, arbitrary: aimed }, { weight: 1, arbitrary: random });
}

function warningArb(form: FormModel): fc.Arbitrary<{ fieldId: string; note: string }> {
  return fc.record({ fieldId: fieldIdArb(form), note: fc.string({ unit: 'grapheme', maxLength: 60 }) });
}

/** What a fake provider may return for `form`. */
function replyArb(form: FormModel): fc.Arbitrary<string> {
  const json = fc
    .record(
      { suggestions: fc.array(suggestionArb(form), { maxLength: 25 }), warnings: fc.array(warningArb(form), { maxLength: 4 }) },
      { requiredKeys: [] },
    )
    .map((o) => JSON.stringify(o));
  return fc.oneof(
    { weight: 1, arbitrary: fc.string() },
    { weight: 1, arbitrary: anyStringArb() },
    { weight: 4, arbitrary: json },
    { weight: 1, arbitrary: json.map((t) => `Here are my suggestions:\n\`\`\`json\n${t}\n\`\`\``) },
    { weight: 2, arbitrary: fc.tuple(json, fc.nat()).map(([t, cut]) => t.slice(0, cut % (t.length + 1))) },
    { weight: 1, arbitrary: fc.jsonValue().map((v) => JSON.stringify({ suggestions: v })) },
  );
}

const inputArb = mappingInputArb().chain(([form, answers, signatures]) =>
  fc.tuple(fc.constant(form), fc.constant(answers), fc.constant(signatures), replyArb(form)),
);

/** P1, as in src/mapping/map-answers.property.test.ts, for one field of a merged result. */
function expectRequiredRule(field: FormField, r: FieldResult, ctx: ValidationContext): void {
  if (r.status === 'filled') {
    const again = validateField(field, r.value ?? '', ctx);
    expect(again.ok && again.value).toBe(r.value);
    expect(r.value).not.toBe('');
  } else if (r.status === 'flagged') {
    expect(hasError(r)).toBe(true);
  } else if (field.type !== 'photo') {
    expect(field.required).toBe(false);
    expect(hasError(r)).toBe(false);
  }
}

/**
 * The rules every merged field follows: P1, protected fields unchanged, and any other change is
 * either a fill by "llm" from an empty or flagged field with the first non-blank value suggested
 * for it, or the old field with one llm-rejected issue added.
 */
function expectMergedField(field: FormField, was: FieldResult, r: FieldResult, suggestions: readonly LlmSuggestion[], ctx: ValidationContext): void {
  expect(r.fieldId).toBe(field.id);
  expectRequiredRule(field, r, ctx);
  if (isProtected(field, was)) {
    expect(r).toEqual(was);
    return;
  }
  if (was.status !== 'filled' && r.status === 'filled') {
    // Answers in the generated input may have source "llm" too, so a fill is told apart by status.
    expect(['empty', 'flagged']).toContain(was.status);
    expect(r.provenance).toBe('llm');
    expect(r.issues.at(-1)).toEqual(llmIssue(field.id, 'llm-suggestion'));
    // The value is the validated form of the value the model suggested; nothing is made up.
    const first = suggestions.find((s) => s.fieldId === field.id && s.value !== undefined && normaliseText(s.value) !== '');
    const fromModel = validateField(field, first?.value ?? '', ctx);
    expect(fromModel.ok && fromModel.value).toBe(r.value);
    return;
  }
  const { issues, ...rest } = r;
  const { issues: wasIssues, ...wasRest } = was;
  expect(rest).toEqual(wasRest);
  expect(issues.slice(0, wasIssues.length)).toEqual(wasIssues);
  const added = issues.slice(wasIssues.length);
  expect(added.length === 0 || (added.length === 1 && added[0]?.code === 'llm-rejected')).toBe(true);
}

const countIssues = (result: MappingResult, code: string): number => Object.values(result.fields).flatMap((f) => f.issues).filter((i) => i.code === code).length;

describe('P5: LLM output never fills a field with an invalid value or replaces what the user entered', () => {
  it('holds for any string a fake provider returns, and assistWithProvider never rejects', async () => {
    await fc.assert(
      fc.asyncProperty(inputArb, validationContextArb(), async ([form, answers, signatures, reply], ctx) => {
        const ruleResult = mapAnswers(form, answers, signatures, ctx);
        const before = structuredClone(ruleResult);
        const provider = fakeProvider(reply);
        const outcome: LlmOutcome = await assistWithProvider(provider, form, answers, ruleResult, new AbortController().signal, ctx);

        expect(ruleResult).toEqual(before);
        expect(provider.requests).toEqual([buildRequest(form, answers)]);
        const suggestions = parseReply(reply);
        if (suggestions === null) {
          expect(outcome).toEqual({ kind: 'fallback', result: ruleResult, reason: 'bad-output' });
          return;
        }
        expect(outcome.kind).toBe('ok');
        if (outcome.kind !== 'ok') return;
        const { result } = outcome;
        expect(result.formId).toBe(ruleResult.formId);
        expect(result.unmatched).toEqual(ruleResult.unmatched);
        expect(Object.keys(result.fields).sort()).toEqual(form.fields.map((f) => f.id).sort());
        let filledByLlm = 0;
        for (const field of form.fields) {
          const was = ruleResult.fields[field.id] as FieldResult;
          const r = result.fields[field.id] as FieldResult;
          expectMergedField(field, was, r, suggestions, ctx);
          if (was.status !== 'filled' && r.status === 'filled') filledByLlm += 1;
        }
        expect(outcome.accepted).toBe(filledByLlm);
        expect(outcome.rejected).toBe(countIssues(result, 'llm-rejected'));
        const ids = new Set(form.fields.map((f) => f.id));
        for (const n of outcome.notes) {
          expect(ids.has(n.fieldId)).toBe(true);
          expect(n.note).toBe(normaliseText(n.note));
          expect(n.note).not.toBe('');
        }
      }),
    );
  });
});

describe('P1 re-check: required fields stay filled or flagged after the merge', () => {
  // Suggestions handed to the merge directly, without the parser's caps: any field ID, any
  // string (over 200 characters too), with or without a note.
  const directArb = mappingInputArb().chain(([form, answers, signatures]) =>
    fc.tuple(
      fc.constant(form),
      fc.constant(answers),
      fc.constant(signatures),
      fc.array(
        fc.oneof(
          suggestionArb(form),
          warningArb(form),
          fc.record({ fieldId: fieldIdArb(form), value: anyStringArb(), note: fc.string() }, { requiredKeys: ['fieldId'] }),
        ),
        { maxLength: 30 },
      ),
      // Entries removed from the rule-based result, as in a result built by hand.
      fc.subarray(form.fields.map((f) => f.id)),
    ),
  );

  it('holds for any suggestions given to mergeSuggestions, even when entries are missing from the rule-based result', () => {
    fc.assert(
      fc.property(directArb, validationContextArb(), ([form, answers, signatures, suggestions, dropped], ctx) => {
        const full = mapAnswers(form, answers, signatures, ctx);
        const ruleResult: MappingResult = { ...full, fields: Object.fromEntries(Object.entries(full.fields).filter(([id]) => !dropped.includes(id))) };
        const result = mergeSuggestions(form, ruleResult, suggestions, ctx);
        expect(Object.keys(result.fields).sort()).toEqual(form.fields.map((f) => f.id).sort());
        for (const field of form.fields) {
          const r = result.fields[field.id] as FieldResult;
          expectRequiredRule(field, r, ctx);
          const was = ruleResult.fields[field.id];
          if (was !== undefined) {
            expectMergedField(field, was, r, suggestions, ctx);
          } else if (field.required && field.type !== 'photo' && r.status !== 'filled') {
            const code = field.type === 'signature' ? 'signature-missing' : 'required-missing';
            expect(r.issues.map((i) => i.code)).toContain(code);
          }
        }
      }),
    );
  });
});

describe('P5 and P1 generators reach every case, so the properties are not vacuous', () => {
  it('fill fields, reject values, aim suggestions at protected fields and give bad output and notes', async () => {
    const samples = fc.sample(fc.tuple(inputArb, validationContextArb()), { numRuns: 300, seed: 17 });
    const seen = { filled: 0, rejected: 0, protectedAimed: 0, badOutput: 0, ok: 0, notes: 0, flaggedFilled: 0 };
    for (const [[form, answers, signatures, reply], ctx] of samples) {
      const ruleResult = mapAnswers(form, answers, signatures, ctx);
      const outcome = await assistWithProvider(fakeProvider(reply), form, answers, ruleResult, new AbortController().signal, ctx);
      if (outcome.kind === 'fallback') seen.badOutput += 1;
      if (outcome.kind !== 'ok') continue;
      seen.ok += 1;
      seen.filled += outcome.accepted;
      seen.rejected += outcome.rejected;
      seen.notes += outcome.notes.length;
      const suggested = new Set((parseReply(reply) ?? []).filter((s) => s.value !== undefined).map((s) => s.fieldId));
      for (const field of form.fields) {
        const was = ruleResult.fields[field.id] as FieldResult;
        if (suggested.has(field.id) && isProtected(field, was)) seen.protectedAimed += 1;
        if (was.status === 'flagged' && outcome.result.fields[field.id]?.status === 'filled') seen.flaggedFilled += 1;
      }
    }
    for (const [name, n] of Object.entries(seen)) expect([name, n > 0]).toEqual([name, true]);
  });
});
