// Local visual experiment for pdf-regeneration task 7; not an application dependency.
// regenerator-runtime is already pinned via Tesseract. Fontkit 1.1.1's subset
// iterator needs this global in Node; the application canvas path does not.
import "regenerator-runtime/runtime.js";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5173/");
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
  throw new Error(
    "This experiment only connects to a local development server.",
  );
const phrases = [
  { label: "Common conjuncts", text: "क्ष त्र ज्ञ श्र" },
  { label: "Application phrase", text: "प्रवेश के लिए क्षमा और श्रद्धा" },
  { label: "Name and study", text: "श्रद्धा त्रिपाठी शिक्षा" },
  { label: "Scholarship", text: "छात्रवृत्ति आवेदन" },
  { label: "Short and long vowels", text: "कि की कृ के कै को कौ" },
  { label: "Marks and digits", text: "अंक ०५/०३/२००४" },
];
const dir = resolve("output/pdf");
await mkdir(dir, { recursive: true });
const pdfPath = resolve(dir, "hindi-rendering-comparison.pdf");
const prefix = resolve(dir, "hindi-rendering-comparison");
const browser = await chromium.launch();
let report;
try {
  const page = await browser.newPage();
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin !== origin.origin)
      return route.abort();
    return route.continue();
  });
  await page.goto(origin.href, { waitUntil: "networkidle" });
  const images = await page.evaluate(async (rows) => {
    const { renderTextImage } = await import("/src/pdf/text-image.ts");
    return Promise.all(
      rows.map(async ({ text }) =>
        Array.from(await renderTextImage(text, 226, 28)),
      ),
    );
  }, phrases);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const custom = await doc.embedFont(
    await readFile("public/fonts/NotoSansDevanagari-Regular.ttf"),
    { subset: true },
  );
  const latin = await doc.embedFont(StandardFonts.Helvetica);
  const sheet = doc.addPage([595.28, 700]);
  const ink = rgb(0.075, 0.17, 0.14);
  const text = (value, x, y, size = 10) =>
    sheet.drawText(value, { x, y, size, font: latin, color: ink });
  text("DEMO DATA / HINDI RENDERING COMPARISON", 35, 665, 16);
  text(
    "Same Noto Sans Devanagari v2.007 font, 12 pt; no real form or personal data.",
    35,
    641,
    10,
  );
  text("Fontkit drawText (subset)", 35, 608, 12);
  text("Application canvas PNG", 310, 608, 12);
  for (const [i, row] of phrases.entries()) {
    const y = 548 - i * 80;
    text(`${i + 1}. ${row.label}`, 35, y + 36);
    for (const x of [35, 310])
      sheet.drawRectangle({
        x,
        y,
        width: 242,
        height: 32,
        borderWidth: 0.5,
        borderColor: rgb(0.65, 0.7, 0.65),
      });
    sheet.drawText(row.text, {
      x: 39,
      y: y + 10,
      size: 12,
      font: custom,
      color: ink,
    });
    sheet.drawImage(await doc.embedPng(Uint8Array.from(images[i])), {
      x: 314,
      y: y + 2,
      width: 226,
      height: 28,
    });
  }
  text(
    "Visual experiment only. Canvas text is rasterised and cannot be selected or searched.",
    35,
    60,
    9,
  );
  text(
    "Compare joins, vowel marks and spacing; this sheet is not a general shaping guarantee.",
    35,
    45,
    9,
  );
  doc.setTitle("SAMPLE / DEMO DATA - Hindi rendering comparison");
  doc.setSubject("Stitchform local visual experiment, not a submitted form");
  await writeFile(pdfPath, await doc.save());
  const render = spawnSync(
    "pdftoppm",
    ["-singlefile", "-r", "150", "-png", pdfPath, prefix],
    { encoding: "utf8" },
  );
  if (render.error || render.status !== 0)
    throw new Error(
      `Poppler rendering failed: ${render.error?.message ?? render.stderr}`,
    );
  report = {
    generatedAt: new Date().toISOString(),
    runtime: process.version,
    browser: browser.version(),
    platform: `${process.platform} ${process.arch}`,
    libraries: {
      pdfLib: "1.17.1",
      fontkit: "1.1.1",
      nodeCompatibilityRuntime:
        "regenerator-runtime 0.13.11 (Tesseract dependency)",
    },
    font: "Noto Sans Devanagari Regular v2.007",
    sampleType: "DEMO DATA; synthetic phrases, not personal data",
    phrases,
    artifacts: [
      "output/pdf/hindi-rendering-comparison.pdf",
      "output/pdf/hindi-rendering-comparison.png",
    ],
    inspection:
      "Requires visual review; successful PDF creation does not establish correct shaping.",
    limits:
      "Chromium canvas and Poppler only; not Firefox, print hardware, assistive technology or all Hindi text.",
  };
  await writeFile(
    "reports/hindi-rendering-comparison.json",
    JSON.stringify(report, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
console.log(
  `Generated ${report.artifacts.join(" and ")}; visually inspect before claiming a result.`,
);
