import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const results = [];
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  async function capture(name, shot = true) {
    await page.evaluate(() => document.fonts.ready);
    const info = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      lang: document.documentElement.lang,
      step: document.querySelector("#app").dataset.view,
      fonts: [...document.fonts].map((f) => ({
        family: f.family,
        status: f.status,
      })),
      animation: document.querySelector(".task-panel")
        ? getComputedStyle(document.querySelector(".task-panel")).animationName
        : null,
    }));
    results.push({ name, ...info });
    if (shot)
      await page.screenshot({
        path: `output/playwright/revamp-${name}.png`,
        fullPage: true,
        animations: "disabled",
      });
  }
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await capture("home-desktop");
  await page
    .getByRole("button", { name: "Try this sample", exact: true })
    .first()
    .click();
  await capture("check-desktop");
  await page
    .getByRole("button", { name: "Continue to answers", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Asha Willow");
  await page
    .getByRole("button", { name: "Save answer and next", exact: true })
    .click();
  await page.getByLabel("Date of birth", { exact: true }).fill("5 March 2004");
  await page.getByLabel("Date of birth", { exact: true }).press("Tab");
  await capture("answer-desktop");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "output/playwright/revamp-workspace-preview.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "04 Review", exact: true }).click();
  await capture("review-desktop");
  await page
    .getByRole("button", { name: "05 Print and save", exact: true })
    .click();
  await capture("save-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "03 Answer", exact: true }).click();
  await page
    .getByRole("button", { name: "05 Print and save", exact: true })
    .click();
  await capture("save-mobile");
  await page.getByRole("button", { name: "03 Answer", exact: true }).click();
  await capture("answer-mobile");
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await capture("home-mobile");
  await page.setViewportSize({ width: 320, height: 850 });
  await page.getByLabel("Language", { exact: true }).selectOption("hi");
  await capture("home-hindi-320");
  await page
    .getByRole("button", { name: "यह नमूना आज़माएँ", exact: true })
    .first()
    .click();
  await capture("check-hindi-320");
  await page
    .getByRole("button", { name: "उत्तर देना शुरू करें", exact: true })
    .click();
  await capture("answer-hindi-320");
  await page.getByRole("button", { name: "04 समीक्षा", exact: true }).click();
  await capture("review-hindi-320");
  await page
    .getByRole("button", { name: "05 प्रिंट और सहेजें", exact: true })
    .click();
  await capture("save-hindi-320");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await capture("reduced-motion", false);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await capture("save-hindi-text-200");
  await page.getByRole("button", { name: "03 उत्तर दें", exact: true }).click();
  await capture("answer-hindi-text-200");
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.getByLabel("Language", { exact: true }).selectOption("hi");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await capture("home-hindi-text-200");
  const manifest = {
    at: new Date().toISOString(),
    browser: browser.version(),
    mode: "Local browser inspection; demo answers; no camera, microphone or model request",
    errors,
    results,
  };
  await writeFile(
    "output/playwright/revamp-inspection.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        browser: manifest.browser,
        errors,
        overflow: results.filter((r) => r.scrollWidth > r.width),
        captures: results.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
