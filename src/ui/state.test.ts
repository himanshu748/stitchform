import { expect, it } from "vitest";
import { initialState, navigate } from "./state";
import { colours, contrastRatio } from "./contrast";
import { en } from "./strings.en";
import { hi } from "./strings.hi";
it("keeps answers when moving back", () => {
  const s = initialState();
  s.answers = [{ seq: 1, text: "DEMO DATA", lang: "en", source: "typed" }];
  expect(navigate(s, "choose").answers).toBe(s.answers);
});
it("has the same English and Hindi string keys", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(hi).sort());
});
it("uses readable text, boundaries and field states", () => {
  for (const c of [colours.ink, colours.muted, colours.warning])
    expect(contrastRatio(c, colours.paper)).toBeGreaterThan(4.5);
  expect(contrastRatio(colours.thread, colours.dark)).toBeGreaterThan(4.5);
  expect(contrastRatio(colours.border, colours.paper)).toBeGreaterThan(3);
});

import fc from "fast-check";
import { nextField } from "./state";
import type { FormModel, MappingResult } from "../form-model";
it("always finds an unfinished field or proves none remain", () =>
  fc.assert(
    fc.property(fc.array(fc.boolean(), { maxLength: 30 }), (filled) => {
      const form: FormModel = {
        id: "demo",
        title: "DEMO DATA",
        source: "sample",
        pages: [],
        fields: filled.map((_, i) => ({
          id: `f-${i}`,
          label: "Demo",
          type: "text",
          page: 0,
          required: true,
          bbox: { x: 0, y: 0, w: 0.1, h: 0.1 },
        })),
      };
      const result: MappingResult = {
        formId: form.id,
        unmatched: [],
        fields: Object.fromEntries(
          filled.map((done, i) => [
            `f-${i}`,
            {
              fieldId: `f-${i}`,
              status: done ? "filled" : "flagged",
              issues: [],
            },
          ]),
        ),
      };
      const index = nextField(form, result);
      expect(index).toBe(filled.findIndex((done) => !done));
    }),
  ));
it("contrast is symmetric, bounded, and black on white is 21", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 0xffffff }),
      fc.integer({ min: 0, max: 0xffffff }),
      (a, b) => {
        const x = "#" + a.toString(16).padStart(6, "0"),
          y = "#" + b.toString(16).padStart(6, "0");
        const r = contrastRatio(x, y);
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(21);
        expect(r).toBe(contrastRatio(y, x));
      },
    ),
  );
});
