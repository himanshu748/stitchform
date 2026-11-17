import type { BBox, FormModel, FormField, FieldType } from "../form-model";
import { normaliseLabel } from "../mapping";
import { allSynonyms } from "../mapping/synonyms";
export interface OcrWord {
  text: string;
  confidence: number;
  box: BBox;
  line: number;
}
export interface SampleTemplate extends FormModel {
  labelsHi: Record<string, string>;
  kind: string;
}
export const SAMPLE_IDS = [
  "sample-lantern-hill-admission",
  "sample-moonfield-scholarship",
  "sample-hollowbrook-hostel",
];
export function matchSampleTitle(
  text: string,
  templates: SampleTemplate[],
): SampleTemplate | undefined {
  const key = normaliseLabel(text);
  return templates.find((t) => {
    const tokens = normaliseLabel(t.title)
      .split(" ")
      .filter((s) => s.length > 3 && s !== "fictional");
    return (
      tokens.filter((s) => key.includes(s)).length >=
      Math.max(2, Math.ceil(tokens.length * 0.7))
    );
  });
}
export function inferType(label: string): FieldType {
  const s = normaliseLabel(label);
  if (/signature|हस्ताक्षर/u.test(s)) return "signature";
  if (/date|dob|तिथि/u.test(s)) return "date";
  if (/photo|तस्वीर/u.test(s)) return "photo";
  if (/marks|score|अंक/u.test(s)) return "number";
  return "text";
}
export function proposeFields(words: OcrWord[]): FormField[] {
  const lines = new Map<number, OcrWord[]>();
  for (const w of words) {
    const a = lines.get(w.line) ?? [];
    a.push(w);
    lines.set(w.line, a);
  }
  const known = [...allSynonyms().values()].flat();
  const fields: FormField[] = [];
  for (const line of lines.values()) {
    const label = line
        .map((w) => w.text)
        .join(" ")
        .trim(),
      key = normaliseLabel(label);
    if (
      !label.endsWith(":") &&
      !known.some((s) => key === s || key.startsWith(s + " "))
    )
      continue;
    const x = Math.min(...line.map((w) => w.box.x)),
      y = Math.max(...line.map((w) => w.box.y + w.box.h)) + 0.005;
    if (y > 0.92) continue;
    fields.push({
      id: `field-${fields.length + 1}`,
      label: label.slice(0, 150),
      type: inferType(label),
      required: label.includes("*"),
      page: 0,
      bbox: { x: Math.max(0.04, x), y, w: Math.max(0.05, 0.94 - x), h: 0.03 },
      ...(/birth|dob|जन्म/u.test(key) ? { dateRole: "dob" as const } : {}),
    });
  }
  return fields.slice(0, 100);
}
// A scale/translate fit on matched label centres; template labels sit .018 page units above boxes.
export function alignTemplate(
  template: SampleTemplate,
  words: OcrWord[],
): { form: SampleTemplate; matched: number } {
  const groups = new Map<number, OcrWord[]>();
  for (const w of words) {
    const a = groups.get(w.line) ?? [];
    a.push(w);
    groups.set(w.line, a);
  }
  const anchors: { sx: number; sy: number; tx: number; ty: number }[] = [];
  for (const f of template.fields) {
    const expected = normaliseLabel(f.label);
    const line = [...groups.values()].find((ws) =>
      normaliseLabel(ws.map((w) => w.text).join(" ")).startsWith(expected),
    );
    if (line)
      anchors.push({
        sx: f.bbox.x,
        sy: f.bbox.y - 0.018,
        tx: Math.min(...line.map((w) => w.box.x)),
        ty: Math.min(...line.map((w) => w.box.y)),
      });
  }
  if (anchors.length < 3)
    return { form: structuredClone(template), matched: anchors.length };
  const fit = (source: "sx" | "sy", target: "tx" | "ty") => {
    const a = anchors.map((p) => p[source]),
      b = anchors.map((p) => p[target]),
      am = a.reduce((s, x) => s + x, 0) / a.length,
      bm = b.reduce((s, x) => s + x, 0) / b.length;
    const den = a.reduce((s, x) => s + (x - am) ** 2, 0);
    const scale =
      den < 1e-8
        ? 1
        : a.reduce((s, x, i) => s + (x - am) * (b[i]! - bm), 0) / den;
    return {
      scale: Math.max(0.7, Math.min(1.3, scale)),
      offset: bm - scale * am,
    };
  };
  const fx = fit("sx", "tx"),
    fy = fit("sy", "ty");
  return {
    matched: anchors.length,
    form: {
      ...template,
      fields: template.fields.map((f) => {
        const x = Math.max(0, Math.min(0.9, fx.scale * f.bbox.x + fx.offset)),
          y = Math.max(0, Math.min(0.95, fy.scale * f.bbox.y + fy.offset));
        return {
          ...f,
          bbox: {
            x,
            y,
            w: Math.min(1 - x, f.bbox.w * fx.scale),
            h: Math.min(1 - y, f.bbox.h * fy.scale),
          },
        };
      }),
    },
  };
}
