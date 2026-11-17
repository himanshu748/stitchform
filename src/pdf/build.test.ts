import { expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { buildPdf } from "./build";
import type { FormModel } from "../form-model";
import { mapAnswers } from "../mapping";
it("makes a reloadable A4 PDF for each sample, with bilingual values through the image path", async () => {
  for (const file of readdirSync("public/samples").filter((f) =>
    f.endsWith(".template.json"),
  )) {
    const form = JSON.parse(
      readFileSync(`public/samples/${file}`, "utf8"),
    ) as FormModel;
    const answers = [
      {
        text: "दीपक मेघ",
        source: "typed" as const,
        lang: "hi" as const,
        promptedFieldId: "full-name",
        seq: 1,
      },
    ];
    const result = mapAnswers(form, answers, new Set(), {
      today: { y: 2026, m: 11, d: 17 },
      lang: "hi",
    });
    let calls = 0;
    const output = await buildPdf(
      {
        form,
        result,
        background: {
          kind: "sample-pdf",
          bytes: new Uint8Array(readFileSync(`public/samples/${form.id}.pdf`)),
        },
        signatures: new Map(),
        isSample: true,
        printFlagged: false,
      },
      async () => {
        calls++;
        return new Uint8Array(readFileSync(`public/samples/${form.id}.png`));
      },
    );
    const doc = await PDFDocument.load(output.bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28);
    expect(doc.getTitle()).toContain("SAMPLE / DEMO DATA");
    expect(doc.getTitle()).not.toContain("दीपक");
    expect(calls).toBe(1);
  }
});
it("reports unsupported text instead of silently losing it without a browser renderer", async () => {
  const form = JSON.parse(
    readFileSync(
      "public/samples/sample-hollowbrook-hostel.template.json",
      "utf8",
    ),
  ) as FormModel;
  const result = mapAnswers(
    form,
    [
      {
        text: "आशा",
        source: "typed",
        lang: "hi",
        promptedFieldId: "full-name",
        seq: 1,
      },
    ],
    new Set(),
    { today: { y: 2026, m: 11, d: 17 }, lang: "hi" },
  );
  expect(
    (
      await buildPdf({
        form,
        result,
        background: { kind: "clean" },
        signatures: new Map(),
        isSample: true,
        printFlagged: false,
      })
    ).warnings,
  ).toContainEqual({ fieldId: "full-name", code: "font-unavailable" });
});
