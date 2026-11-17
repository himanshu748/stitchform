import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateFormModel, type FormModel } from "../form-model";
import { mapAnswers } from "../mapping";
import { SAMPLE_IDS } from "./detect";
it("ships valid original bilingual templates and flags all missing required fields", () => {
  for (const id of SAMPLE_IDS) {
    const form = JSON.parse(
      readFileSync(`public/samples/${id}.template.json`, "utf8"),
    ) as FormModel & { labelsHi: Record<string, string> };
    expect(validateFormModel(form)).toEqual({ ok: true });
    for (const f of form.fields) expect(form.labelsHi[f.id]).toBeTruthy();
    const r = mapAnswers(form, [], new Set(), {
      lang: "en",
      today: { y: 2026, m: 11, d: 17 },
    });
    for (const f of form.fields.filter((f) => f.required))
      expect(r.fields[f.id]!.status).toBe("flagged");
  }
});
