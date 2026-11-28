import { createWorker, OEM } from "tesseract.js";
import type { FormModel } from "../form-model";
import {
  alignTemplate,
  matchSampleTitle,
  proposeFields,
  type OcrWord,
  type SampleTemplate,
} from "./detect";
export { SAMPLE_IDS } from "./detect";
export type { SampleTemplate } from "./detect";
let active = false;
export async function detectFields(
  canvas: HTMLCanvasElement,
  templates: SampleTemplate[],
  progress: (n: number) => void,
  signal: AbortSignal,
): Promise<{ form: FormModel; text: string; matched: number; ms: number }> {
  if (active)
    throw new Error(
      "A form is already being read. Cancel it before trying another.",
    );
  active = true;
  const start = performance.now();
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  const abort = () => {
    void worker?.terminate();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    worker = await createWorker(["eng", "hin"], OEM.LSTM_ONLY, {
      workerPath: "../tesseract/worker.min.js",
      corePath: "../tesseract/core",
      langPath: "../tesseract/lang",
      workerBlobURL: false,
      cacheMethod: "none",
      logger: (m) => {
        if (m.status === "recognizing text") progress(m.progress);
      },
    });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const { data } = await worker.recognize(
      canvas,
      { rotateAuto: true },
      { blocks: true },
    );
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const words: OcrWord[] = [];
    let lineIndex = 0;
    for (const block of data.blocks ?? [])
      for (const paragraph of block.paragraphs)
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            const b = word.bbox;
            words.push({
              text: word.text,
              confidence: word.confidence,
              line: lineIndex,
              box: {
                x: Math.max(0, b.x0 / canvas.width),
                y: Math.max(0, b.y0 / canvas.height),
                w: Math.min(1, (b.x1 - b.x0) / canvas.width),
                h: Math.min(1, (b.y1 - b.y0) / canvas.height),
              },
            });
          }
          lineIndex++;
        }
    const sample = matchSampleTitle(data.text, templates),
      aligned = sample ? alignTemplate(sample, words) : undefined;
    const form: FormModel = aligned?.form ?? {
      id: "uploaded-form",
      title: "Your photographed form",
      source: "ocr",
      pages: [{ index: 0, widthPt: 595.28, heightPt: 841.89 }],
      fields: proposeFields(words),
    };
    if (!sample) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify(
            form.fields.map((f) => ({
              label: f.label,
              type: f.type,
              bbox: f.bbox,
            })),
          ),
        ),
      );
      form.id =
        "upload-" +
        Array.from(new Uint8Array(digest))
          .slice(0, 12)
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
    }
    return {
      form,
      text: data.text,
      matched: aligned?.matched ?? form.fields.length,
      ms: performance.now() - start,
    };
  } finally {
    signal.removeEventListener("abort", abort);
    try {
      await worker?.terminate();
    } catch {
      /* already terminated by cancel */
    }
    active = false;
  }
}
