// fast-check generators shared by the property tests P1, P4 (field-mapping) and P5 (llm-adapter).
// Everything generated here is fictional demo data by construction: labels come from the
// sample-form vocabulary or random strings, never from real people or real forms.

import fc from 'fast-check';
import type { Answer, AnswerSource, BBox, FieldType, FormField, FormModel, PageInfo } from '../form-model';
import { rawAnswerArb, rawForFieldArb } from '../validation/arbitraries';
import { synonymsFor } from './synonyms';

export const FIELD_TYPES = [
  'text',
  'date',
  'number',
  'choice',
  'checkbox',
  'signature',
  'photo',
] as const satisfies readonly FieldType[];

/**
 * Labels that look like the ones on the three sample forms, in English and Hindi, plus a few
 * deliberately vague ones ("Name", "Date") so that two fields can share a label.
 */
export const DEMO_LABELS = [
  'Full name',
  'Name',
  'Date of birth',
  'DOB',
  'Date',
  'Address',
  'Parent or guardian name',
  'Course choice',
  'Previous marks',
  'Photo',
  'Signature',
  'Family income band',
  'Short statement',
  'Declaration',
  'ID type',
  'Sample ID number',
  'Emergency contact name',
  'Emergency contact phone',
  'Arrival date',
  'Departure date',
  'पूरा नाम',
  'जन्म तिथि',
  'पता',
  'हस्ताक्षर',
  'घोषणा',
] as const;

/** Options for generated choice fields: sample-like options and random non-blank strings. */
export const DEMO_CHOICES = [
  'Sample ID card',
  'Sample student card',
  'Sample other document',
  'Band A (demo)',
  'Band B (demo)',
  'Band C (demo)',
] as const;

const PAGE_A4: Omit<PageInfo, 'index'> = { widthPt: 595.28, heightPt: 841.89 };

// Box edges are multiples of 1/1024, which floating point represents exactly, so x + w <= 1
// holds without rounding surprises.
const STEPS = 1024;

export function bboxArb(): fc.Arbitrary<BBox> {
  const span = fc
    .tuple(fc.integer({ min: 0, max: STEPS }), fc.integer({ min: 0, max: STEPS }))
    .map(([a, b]) => ({ start: Math.min(a, b) / STEPS, size: Math.abs(a - b) / STEPS }));
  return fc.tuple(span, span).map(([h, v]) => ({ x: h.start, y: v.start, w: h.size, h: v.size }));
}

export function labelArb(): fc.Arbitrary<string> {
  return fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom(...DEMO_LABELS) },
    { weight: 1, arbitrary: fc.string({ maxLength: 20 }) },
  );
}

function choicesArb(): fc.Arbitrary<string[]> {
  const option = fc.oneof(
    fc.constantFrom(...DEMO_CHOICES),
    fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim() !== ''),
  );
  return fc.uniqueArray(option, { minLength: 1, maxLength: 4 });
}

const idArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,11}$/);

function fieldArb(pageCount: number): fc.Arbitrary<FormField> {
  return fc
    .record({
      id: idArb,
      label: labelArb(),
      type: fc.constantFrom(...FIELD_TYPES),
      required: fc.boolean(),
      bbox: bboxArb(),
      page: fc.integer({ min: 0, max: pageCount - 1 }),
      choices: choicesArb(),
      dateRole: fc.option(fc.constantFrom('dob' as const, 'other' as const), { nil: null }),
    })
    .map(({ choices, dateRole, ...base }) => {
      const field: FormField = { ...base };
      if (base.type === 'choice') field.choices = choices;
      if (base.type === 'date' && dateRole !== null) field.dateRole = dateRole;
      return field;
    });
}

/** A valid form model (passes validateFormModel) with 1 to 20 fields of every type and 1 to 3 pages. */
export function formModelArb(): fc.Arbitrary<FormModel> {
  return fc.integer({ min: 1, max: 3 }).chain((pageCount) =>
    fc.record({
      id: fc.constant('demo-generated-form'),
      title: fc.constant('Generated form (SAMPLE / DEMO DATA)'),
      source: fc.constantFrom('sample' as const, 'ocr' as const, 'manual' as const),
      pages: fc.constant(Array.from({ length: pageCount }, (_, index) => ({ index, ...PAGE_A4 }))),
      fields: fc.uniqueArray(fieldArb(pageCount), { minLength: 1, maxLength: 20, selector: (f) => f.id }),
    }),
  );
}

/** Longer than any generated field ID (at most 12 characters), so it is never on the form. */
export const ID_NOT_ON_FORM = 'demo-not-on-form';

const SOURCES: readonly AnswerSource[] = ['typed', 'voice', 'stitch-code', 'llm'];
const CONNECTORS = ['', ' is', ':', ' -', ' है'];
const SEPARATORS = [', ', ' and ', '. ', ' और ', ' '];

/** "<label><connector> <value>" aimed at one field, using its printed label or a synonym. */
function labelledPartArb(fields: readonly FormField[]): fc.Arbitrary<string> {
  const aimed = fc.constantFrom(...fields).chain((f) =>
    fc.tuple(fc.constantFrom(f.label, ...synonymsFor(f.label)), fc.constantFrom(...CONNECTORS), rawForFieldArb(f)),
  );
  const loose = fc.tuple(fc.constantFrom(...DEMO_LABELS), fc.constantFrom(...CONNECTORS), rawAnswerArb());
  return fc.oneof({ weight: 3, arbitrary: aimed }, { weight: 1, arbitrary: loose }).map(([l, c, v]) => `${l}${c} ${v}`);
}

/** Free text: one to three labelled parts joined by a separator, or any string at all. */
function freeTextArb(fields: readonly FormField[]): fc.Arbitrary<string> {
  const sentence = fc
    .tuple(fc.array(labelledPartArb(fields), { minLength: 1, maxLength: 3 }), fc.constantFrom(...SEPARATORS))
    .map(([parts, sep]) => parts.join(sep));
  return fc.oneof({ weight: 3, arbitrary: sentence }, { weight: 1, arbitrary: fc.string({ maxLength: 60 }) });
}

/**
 * One answer for `form`: a prompted answer aimed at one of its fields (valid, invalid, blank or
 * any text), a prompted answer for a field the form does not have, or free text naming fields
 * by label or synonym. `seq` values repeat on purpose, so ties are covered.
 */
export function answerArb(form: FormModel): fc.Arbitrary<Answer> {
  const promptedOnForm = fc
    .constantFrom(...form.fields)
    .chain((f) => rawForFieldArb(f).map((text) => ({ promptedFieldId: f.id, text })));
  const promptedOffForm = rawAnswerArb().map((text) => ({ promptedFieldId: ID_NOT_ON_FORM, text }));
  const body = fc.oneof(
    { weight: 4, arbitrary: promptedOnForm },
    { weight: 1, arbitrary: promptedOffForm },
    { weight: 3, arbitrary: freeTextArb(form.fields).map((text) => ({ text })) },
  );
  return fc
    .record({
      body,
      source: fc.constantFrom(...SOURCES),
      lang: fc.constantFrom('en' as const, 'hi' as const),
      seq: fc.integer({ min: 0, max: 30 }),
    })
    .map(({ body: b, ...rest }): Answer => ({ ...rest, ...b }));
}

/** Zero to twelve answers for `form`. */
export function answersArb(form: FormModel): fc.Arbitrary<Answer[]> {
  return fc.array(answerArb(form), { maxLength: 12 });
}

/** Which fields have a drawn or uploaded signature: any subset of the form's field IDs. */
export function signaturesArb(form: FormModel): fc.Arbitrary<ReadonlySet<string>> {
  return fc.subarray(form.fields.map((f) => f.id)).map((ids) => new Set(ids));
}

/** A form with answers and a signature set for it, the input of mapAnswers. */
export function mappingInputArb(): fc.Arbitrary<[FormModel, Answer[], ReadonlySet<string>]> {
  return formModelArb().chain((form) => fc.tuple(fc.constant(form), answersArb(form), signaturesArb(form)));
}
