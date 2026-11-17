import { expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { validateFormModel } from "../form-model";
import {
  matchSampleTitle,
  proposeFields,
  alignTemplate,
  type SampleTemplate,
} from "./detect";
const forms = readdirSync("scripts/samples/templates").map(
  (p) =>
    JSON.parse(
      readFileSync(`scripts/samples/templates/${p}`, "utf8"),
    ) as SampleTemplate,
);
it("validates every original bilingual template", () => {
  for (const form of forms) {
    expect(validateFormModel(form)).toEqual({ ok: true });
    expect(Object.keys(form.labelsHi)).toHaveLength(form.fields.length);
  }
});
it("recognises a fictional title but does not assume every upload is a sample", () => {
  expect(matchSampleTitle(forms[0]!.title, forms)?.id).toBe(forms[0]!.id);
  expect(matchSampleTitle("An unrelated form", forms)).toBeUndefined();
});
it("proposes a date box from an OCR label and requires only explicit stars", () => {
  const fields = proposeFields([
    {
      text: "Date of birth:",
      confidence: 90,
      line: 0,
      box: { x: 0.1, y: 0.2, w: 0.2, h: 0.02 },
    },
  ]);
  expect(fields[0]?.type).toBe("date");
  expect(fields[0]?.required).toBe(false);
  expect(fields[0]!.bbox.y).toBeGreaterThan(0.2);
});
it("keeps template geometry when label positions match", () => {
  const form = forms[0]!,
    words = form.fields.map((f, i) => ({
      text: f.label,
      confidence: 99,
      line: i,
      box: { x: f.bbox.x, y: f.bbox.y - 0.018, w: 0.2, h: 0.01 },
    }));
  const r = alignTemplate(form, words);
  expect(r.matched).toBe(form.fields.length);
  r.form.fields.forEach((f, i) =>
    expect(f.bbox.y).toBeCloseTo(form.fields[i]!.bbox.y, 5),
  );
});
