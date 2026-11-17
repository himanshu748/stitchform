// Original sample layouts. Browser-shaped bilingual labels.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
const out = "public/samples";
await mkdir(out, { recursive: true });
const font = (
  await readFile("public/fonts/NotoSansDevanagari-Regular.ttf")
).toString("base64");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1414 },
    deviceScaleFactor: 1,
  });
  for (const file of (await readdir("scripts/samples/templates"))
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    const form = JSON.parse(
      await readFile(`scripts/samples/templates/${file}`, "utf8"),
    );
    if (form.fields.some((f) => f.bbox.y + f.bbox.h > 1))
      throw Error("Sample field outside page");
    const html = `<style>@font-face{font-family:Noto;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#d9d7cf;color:#222;font:17px Arial}#sheet{position:relative;width:1000px;height:1414px;background:#fffdf7;overflow:hidden}.header{position:absolute;left:8%;top:5%;width:84%;border-bottom:3px solid #283e35;padding-bottom:22px}small{letter-spacing:3px;color:#384e43;font-weight:bold}h1{font-size:26px;max-width:780px}h2{font:20px Georgia}label{position:absolute;left:8%;width:84%;font-weight:600;font-size:17px}.hi{font:17px Noto;margin-left:16px}.box{position:absolute;border:1px solid #777;background:transparent}.watermark{position:absolute;top:46%;left:14%;transform:rotate(-27deg);font:bold 52px Arial;color:#eee9df;letter-spacing:4px}.footer{position:absolute;bottom:4%;left:8%;font-size:13px}.creased{transform:perspective(900px) rotateX(1deg) rotate(-1deg) scale(.965);filter:url(#paper)}.crease{position:absolute;inset:0;pointer-events:none;background:linear-gradient(127deg,transparent 37%,#0001 38%,#fff7 39%,transparent 41%),linear-gradient(74deg,transparent 60%,#0001 61%,#fff9 62%,transparent 63%)}</style><svg style="position:absolute;width:0;height:0"><filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="26" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feBlend in="SourceGraphic" mode="multiply"/></filter></svg><main id="sheet"><div class="watermark">SAMPLE / DEMO DATA</div><div class="header"><small>SAMPLE / DEMO DATA</small><h1>${form.title}</h1><h2>${form.kind}</h2></div>${form.fields.map((f) => `<label style="top:${(f.bbox.y - 0.018) * 100}%">${f.label}${f.required ? " *" : ""}<span class="hi">${form.labelsHi[f.id]}</span></label><div class="box" style="left:${f.bbox.x * 100}%;top:${f.bbox.y * 100}%;width:${f.bbox.w * 100}%;height:${f.bbox.h * 100}%"></div>`).join("")}<div class="footer">Fictional practice form. No institutional or government affiliation. SAMPLE / DEMO DATA</div></main>`;
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ path: `${out}/${form.id}.png` });
    const pdf = await PDFDocument.create();
    const p = pdf.addPage([595.28, 841.89]);
    const img = await pdf.embedPng(png);
    p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    pdf.setTitle(`SAMPLE / DEMO DATA - ${form.kind}`);
    pdf.setCreator("Stitchform sample generator");
    pdf.setCreationDate(new Date("2026-11-15T00:00:00Z"));
    pdf.setModificationDate(new Date("2026-11-15T00:00:00Z"));
    await writeFile(
      `${out}/${form.id}.pdf`,
      Buffer.concat([
        await pdf.save({ useObjectStreams: false }),
        Buffer.from("\n% SAMPLE / DEMO DATA\n"),
      ]),
    );
    await writeFile(
      `${out}/${form.id}.template.json`,
      JSON.stringify(form, null, 2) + "\n",
    );
    await page.evaluate(() => {
      const sheet = document.querySelector("#sheet");
      sheet.classList.add("creased");
      const crease = document.createElement("div");
      crease.className = "crease";
      sheet.append(crease);
    });
    await page.screenshot({ path: `${out}/${form.id}-crumpled.png` });
  }
  const demo = {
    label: "SAMPLE / DEMO DATA",
    people: [
      {
        name: "Asha Willow (fictional)",
        answers: {
          "full-name": "Asha Willow",
          dob: "5 March 2004",
          address: "17 Paper Lane, Demo Town",
          "emergency-contact-name": "Ravi Willow",
          "arrival-date": "2026-12-01",
        },
      },
      {
        name: "दीपक मेघ (काल्पनिक)",
        answers: { "full-name": "दीपक मेघ", dob: "०५/०३/२००४" },
      },
    ],
  };
  await writeFile(
    `${out}/demo-answers.json`,
    JSON.stringify(demo, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
