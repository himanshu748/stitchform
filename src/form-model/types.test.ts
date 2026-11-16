import { describe, expect, expectTypeOf, it } from 'vitest';
import type { FieldType, FormField, FormModel, MappingResult } from './index';

// Compile-time checks of the shared model (field-mapping Req 1.1, 1.2, 1.4), plus one literal
// that must type-check. The data is a fictional demo form.

const ALL_TYPES = ['text', 'date', 'number', 'choice', 'checkbox', 'signature', 'photo'] as const satisfies readonly FieldType[];

describe('form-model types', () => {
  it('FieldType is exactly the seven field types of Req 1.1', () => {
    expectTypeOf<FieldType>().toEqualTypeOf<(typeof ALL_TYPES)[number]>();
    expect(ALL_TYPES).toHaveLength(7);
  });

  it('FormField carries id, label, type, required, bbox and page', () => {
    expectTypeOf<FormField>().toHaveProperty('id').toEqualTypeOf<string>();
    expectTypeOf<FormField>().toHaveProperty('label').toEqualTypeOf<string>();
    expectTypeOf<FormField>().toHaveProperty('required').toEqualTypeOf<boolean>();
    expectTypeOf<FormField>().toHaveProperty('page').toEqualTypeOf<number>();
    expectTypeOf<FormField['bbox']>().toEqualTypeOf<{ x: number; y: number; w: number; h: number }>();
  });

  it('FormModel holds no answers (Req 1.4)', () => {
    expectTypeOf<keyof FormModel>().toEqualTypeOf<'id' | 'title' | 'source' | 'pages' | 'fields'>();
    expectTypeOf<keyof MappingResult>().toEqualTypeOf<'formId' | 'fields' | 'unmatched'>();
  });

  it('accepts a demo form literal with every field type', () => {
    const demo: FormModel = {
      id: 'demo-form',
      title: 'Demo form (SAMPLE / DEMO DATA)',
      source: 'manual',
      pages: [{ index: 0, widthPt: 595.28, heightPt: 841.89 }],
      fields: ALL_TYPES.map((type, i) => ({
        id: `field-${i}`,
        label: `Field ${i}`,
        type,
        required: i % 2 === 0,
        bbox: { x: 0.1, y: 0.05 + i * 0.1, w: 0.5, h: 0.05 },
        page: 0,
        ...(type === 'choice' ? { choices: ['Option A (demo)'] } : {}),
      })),
    };
    expect(demo.fields.map((f) => f.type)).toEqual([...ALL_TYPES]);
  });
});
