import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { FormModel, MappingResult } from "../form-model";
import { toPdfRect } from "./geometry";
import { canEncodeWinAnsi } from "./winansi";
import { fitText } from "./fit";
export type Background =
  | { kind: "clean" }
  | { kind: "sample-pdf"; bytes: Uint8Array }
  | { kind: "photo"; bytes: Uint8Array; mime: "image/png" | "image/jpeg" };
export interface PdfInput {
  form: FormModel;
  result: MappingResult;
  signatures: Map<string, Uint8Array>;
  background: Background;
  isSample: boolean;
  printFlagged: boolean;
}
export interface PdfOutput {
  bytes: Uint8Array<ArrayBuffer>;
  warnings: {
    fieldId: string;
    code: "text-too-long" | "flagged-printed" | "font-unavailable";
  }[];
}
export type TextImage = (
  text: string,
  width: number,
  height: number,
) => Promise<Uint8Array>;
export async function buildPdf(
  input: PdfInput,
  textImage?: TextImage,
): Promise<PdfOutput> {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica);
  const warnings: PdfOutput["warnings"] = [];
  doc.setTitle(
    input.isSample ? "SAMPLE / DEMO DATA - Stitchform" : "Stitchform form",
  );
  doc.setCreator("Stitchform");
  doc.setProducer("Stitchform");
  for (const info of input.form.pages) {
    const w = info.widthPt,
      h = info.heightPt,
      page = doc.addPage([w, h]);
    if (input.background.kind === "sample-pdf") {
      const [bg] = await doc.embedPdf(input.background.bytes, [info.index]);
      if (bg) page.drawPage(bg, { x: 0, y: 0, width: w, height: h });
    }
    if (input.background.kind === "photo") {
      const bg = await (input.background.mime === "image/png"
        ? doc.embedPng(input.background.bytes)
        : doc.embedJpg(input.background.bytes));
      page.drawImage(bg, { x: 0, y: 0, width: w, height: h });
    }
    for (const field of input.form.fields.filter(
      (f) => f.page === info.index,
    )) {
      const rect = toPdfRect(field.bbox, w, h),
        r = input.result.fields[field.id];
      if (input.background.kind === "clean") {
        page.drawRectangle({
          ...rect,
          borderColor: rgb(0.5, 0.55, 0.52),
          borderWidth: 0.5,
        });
        if (canEncodeWinAnsi(field.label))
          page.drawText(field.label, {
            x: rect.x,
            y: rect.y + rect.height + 3,
            size: 9,
            font,
          });
        else if (textImage) {
          const img = await doc.embedPng(
            await textImage(field.label, rect.width, 12),
          );
          page.drawImage(img, {
            x: rect.x,
            y: rect.y + rect.height + 3,
            width: rect.width,
            height: 12,
          });
        }
      }
      if (!r || field.type === "photo") continue;
      if (field.type === "signature") {
        const bytes = input.signatures.get(field.id);
        if (bytes) {
          const img = await doc.embedPng(bytes);
          const scale = Math.min(
            (rect.width - 6) / img.width,
            (rect.height - 6) / img.height,
          );
          page.drawImage(img, {
            x: rect.x + 3,
            y: rect.y + 3,
            width: img.width * scale,
            height: img.height * scale,
          });
        }
        continue;
      }
      const value =
        r.status === "filled"
          ? r.value
          : input.printFlagged
            ? r.raw
            : undefined;
      if (!value) continue;
      if (r.status === "flagged")
        warnings.push({ fieldId: field.id, code: "flagged-printed" });
      if (field.type === "checkbox") {
        if (value === "yes") {
          page.drawLine({
            start: { x: rect.x + 5, y: rect.y + 10 },
            end: { x: rect.x + 10, y: rect.y + 5 },
            thickness: 2,
          });
          page.drawLine({
            start: { x: rect.x + 10, y: rect.y + 5 },
            end: { x: rect.x + 20, y: rect.y + 20 },
            thickness: 2,
          });
        }
        continue;
      }
      if (!canEncodeWinAnsi(value)) {
        if (!textImage) {
          warnings.push({ fieldId: field.id, code: "font-unavailable" });
          continue;
        }
        const img = await doc.embedPng(
          await textImage(value, rect.width - 8, rect.height - 6),
        );
        page.drawImage(img, {
          x: rect.x + 4,
          y: rect.y + 3,
          width: rect.width - 8,
          height: rect.height - 6,
        });
        continue;
      }
      const fit = fitText(value, rect.width - 8, rect.height - 6, (s, n) =>
        font.widthOfTextAtSize(s, n),
      );
      if (fit.clipped)
        warnings.push({ fieldId: field.id, code: "text-too-long" });
      fit.lines.forEach((line, i) =>
        page.drawText(line, {
          x: rect.x + 4,
          y: rect.y + rect.height - (fit.size + 3) * (i + 1),
          size: fit.size,
          font,
          color: rgb(0.07, 0.15, 0.13),
        }),
      );
    }
    if (input.isSample && input.background.kind !== "sample-pdf")
      page.drawText("SAMPLE / DEMO DATA", {
        x: 75,
        y: h * 0.42,
        size: 32,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.22,
        rotate: degrees(26),
      });
  }
  return { bytes: Uint8Array.from(await doc.save()), warnings };
}
