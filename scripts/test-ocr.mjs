import { createWorker, OEM } from "tesseract.js";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
const ids = [
  "sample-lantern-hill-admission",
  "sample-moonfield-scholarship",
  "sample-hollowbrook-hostel",
];
const worker = await createWorker(["eng", "hin"], OEM.LSTM_ONLY, {
  langPath: join(process.cwd(), "public/tesseract/lang"),
  cacheMethod: "none",
});
const results = [];
try {
  for (const id of ids)
    for (const suffix of ["", "-crumpled"]) {
      const start = performance.now(),
        { data } = await worker.recognize(
          `public/samples/${id}${suffix}.png`,
          { rotateAuto: true },
          { blocks: true },
        );
      const form = JSON.parse(
        await readFile(`public/samples/${id}.template.json`, "utf8"),
      );
      const key = (s) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const text = key(data.text);
      const found = form.fields
        .filter((f) => text.includes(key(f.label)))
        .map((f) => f.id);
      results.push({
        file: `${id}${suffix}.png`,
        ms: Math.round(performance.now() - start),
        labelsFound: found.length,
        totalLabels: form.fields.length,
        found,
      });
      console.log(results.at(-1));
      if (!suffix && found.length < Math.ceil(form.fields.length * 0.5))
        throw Error("Too few clean-image labels detected");
    }
} finally {
  await worker.terminate();
  await writeFile(
    "reports/ocr-measurements.json",
    JSON.stringify(
      {
        date: "2026-11-17",
        runtime: process.version,
        machine:
          "macOS arm64 local laptop; synthetic image inputs, not camera footage",
        results,
      },
      null,
      2,
    ) + "\n",
  );
}
