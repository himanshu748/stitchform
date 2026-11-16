import type { BBox, FormField, FormModel } from './types';

function nextFieldId(fields: readonly FormField[]): string {
  const taken = new Set(fields.map((f) => f.id));
  let n = fields.length + 1;
  while (taken.has(`field-${n}`)) n += 1;
  return `field-${n}`;
}

/**
 * Add a field (field-mapping Req 2.2). The new field always gets a fresh unique ID, even if
 * `partial.id` is set, and defaults to type "text" and required false.
 * Returns a new model; the input is not changed.
 */
export function addField(
  m: FormModel,
  partial: Partial<FormField> & { bbox: BBox; page: number },
): FormModel {
  const field: FormField = {
    label: '',
    type: 'text',
    required: false,
    ...partial,
    bbox: { ...partial.bbox },
    id: nextFieldId(m.fields),
  };
  if (partial.choices) field.choices = [...partial.choices];
  return { ...m, fields: [...m.fields, field] };
}

/**
 * Change one field's label, type, required flag, box, page, choices or date role
 * (field-mapping Req 2.1). The ID never changes. An unknown ID returns the model unchanged.
 * Returns a new model; the input is not changed. Callers re-run validateFormModel and mapping.
 */
export function updateField(
  m: FormModel,
  id: string,
  patch: Partial<Omit<FormField, 'id'>>,
): FormModel {
  if (!m.fields.some((f) => f.id === id)) return m;
  return {
    ...m,
    fields: m.fields.map((f) => {
      if (f.id !== id) return f;
      const next: FormField = { ...f, ...patch, id: f.id };
      if (patch.bbox) next.bbox = { ...patch.bbox };
      if (patch.choices) next.choices = [...patch.choices];
      return next;
    }),
  };
}
