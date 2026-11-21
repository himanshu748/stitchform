import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

test("typed no-LLM flow: validation, signature, PDF, encrypted QR refill", async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    foreign: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (
      !["localhost", "127.0.0.1"].includes(u.hostname) &&
      u.protocol !== "data:"
    ) {
      foreign.push(u.origin);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/app/");
  await page.getByRole("button", { name: "Try this sample" }).nth(2).click();
  await page
    .getByRole("button", { name: "Continue to answers", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Asha Willow");
  await page.getByLabel("Full name", { exact: true }).press("Enter");
  await page.getByLabel("Date of birth", { exact: true }).fill("31/02/2004");
  await page.getByLabel("Date of birth", { exact: true }).press("Tab");
  await expect(page.locator("#answer-issues")).toContainText("date");
  await page.getByLabel("Date of birth", { exact: true }).fill("5 March 2004");
  await page.getByLabel("Date of birth", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Date of birth", { exact: true }),
  ).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator('.patch[data-field-id="dob"]')).toHaveAttribute(
    "data-status",
    "filled",
  );
  await expect(page.locator('.patch[data-field-id="dob"]')).toContainText(
    "05/03/2004",
  );
  await page.getByLabel("Date of birth", { exact: true }).press("Enter");
  await page
    .getByLabel("ID type", { exact: true })
    .selectOption("Sample student card");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  for (const [label, value] of [
    ["Address", "17 Paper Lane, Demo Town"],
    ["Emergency contact name", "Ravi Willow"],
  ] as const) {
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Save answer and next" }).click();
  }
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByLabel("Arrival date", { exact: true }).fill("2026-12-01");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  // A synthetic test image exercises upload; the application never invents a signature.
  const fixture = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.locator(".task-panel input[type=file]").setInputFiles({
    name: "demo-signature.png",
    mimeType: "image/png",
    buffer: fixture,
  });
  await expect(
    page.getByRole("button", { name: "Clear signature" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review answers", exact: true })
    .click();
  await expect(page.locator(".task-panel")).toContainText("05/03/2004");
  await page
    .getByRole("button", { name: "Continue to print and save" })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Make and download PDF" }).click();
  const download = await downloadEvent;
  const pdf = await PDFDocument.load(await readFile((await download.path())!));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getTitle()).toContain("SAMPLE / DEMO DATA");
  await page.getByRole("button", { name: "Generate five words" }).click();
  await expect(page.getByLabel("Passphrase", { exact: true })).not.toHaveValue(
    "",
  );
  const passphrase = await page
    .getByLabel("Passphrase", { exact: true })
    .inputValue();
  await page
    .getByRole("button", { name: "Make stitch code", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Download QR image" }),
  ).toBeVisible();
  const qrEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download QR image" }).click();
  const qr = await qrEvent;
  const qrPath = path.join(testInfo.outputDir, "stitchform-code.png");
  await qr.saveAs(qrPath);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Open a form" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open a stitch code", exact: true })
    .click();
  await page.getByLabel("QR image or .stitch file").setInputFiles(qrPath);
  await page.getByLabel("Passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Unlock and refill" }).click();
  await expect(page.locator(".task-panel")).toContainText("Asha Willow");
  await expect(page.locator(".task-panel")).toContainText("05/03/2004");
  await expect(page.locator(".task-panel")).toContainText(
    "needs your signature",
  );
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test("mobile, Hindi, keyboard and reduced-motion states", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/");
  await expect(
    page.getByRole("heading", { name: "Open a form" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Reach a sample using Tab, with no pointer clicks.
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press("Tab");
    if (
      await page.evaluate(
        () => document.activeElement?.textContent === "Try this sample",
      )
    )
      break;
  }
  await expect(page.locator(".sample-viewer img")).toHaveAttribute(
    "alt",
    "College admission",
  );
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Check detected fields" }),
  ).toBeVisible();
  await page.getByLabel("Language").selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("भाषा").selectOption("en");
  const patch = page.locator(".patch").first();
  await patch.focus();
  const before = await patch.evaluate((e) => (e as HTMLElement).style.left);
  await page.keyboard.press("ArrowRight");
  expect(
    await page
      .locator(".patch")
      .first()
      .evaluate((e) => (e as HTMLElement).style.left),
  ).not.toBe(before);
  expect(
    await page
      .locator(".patch")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Privacy", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("uploaded sample runs local English/Hindi OCR without third-party requests", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const foreign: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !["localhost", "127.0.0.1"].includes(new URL(r.url()).hostname)
    )
      foreign.push(r.url());
  });
  await page.goto("/app/");
  await page
    .locator("main input[type=file]")
    .setInputFiles("public/samples/sample-moonfield-scholarship.png");
  await expect(
    page.getByRole("heading", { name: "Check detected fields" }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole("heading", {
      name: "Moonfield Merit Scholarship Trust (fictional)",
    }),
  ).toBeVisible();
  expect(await page.locator(".patch").count()).toBe(7);
  expect(foreign).toEqual([]);
});

test("Hindi values produce a PDF using the bundled font", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Try this sample" }).first().click();
  await page
    .getByRole("button", { name: "Continue to answers", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("दीपक मेघ");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await page
    .getByRole("button", { name: "Review answers", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue to print and save" })
    .click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Make and download PDF" }).click();
  const download = await event;
  await download.saveAs("/tmp/stitchform-hindi-filled.pdf");
  expect(
    await page.evaluate(() =>
      document.fonts.check('12px "Stitchform Devanagari"'),
    ),
  ).toBe(true);
  const doc = await PDFDocument.load(
    await readFile("/tmp/stitchform-hindi-filled.pdf"),
  );
  expect(doc.getPageCount()).toBe(1);
});

test("optional model UI keeps rules on a simulated 503, and never sends the image", async ({
  page,
}) => {
  let sent: Record<string, unknown> | undefined;
  await page.route("https://demo.invalid/**", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 503, body: "warming up" });
  });
  await page.goto("/app/");
  await page.getByRole("button", { name: "Try this sample" }).first().click();
  await page.getByRole("button", { name: "04 Review", exact: true }).click();
  await page.getByText("LLM · Off", { exact: true }).click();
  await page.getByLabel("Enable optional LLM help").check();
  await expect(page.getByLabel("Provider", { exact: true })).toHaveValue(
    "modal",
  );
  await page.getByLabel("Modal endpoint URL").fill("https://demo.invalid");
  page.once("dialog", async (d) => {
    expect(d.message()).toContain("demo.invalid");
    await d.accept();
  });
  await page.getByRole("button", { name: "Ask for suggestions" }).click();
  await expect(page.getByRole("status")).toContainText("warming up");
  expect(sent).toBeDefined();
  expect(JSON.stringify(sent)).not.toContain("data:image");
  await expect(page.locator(".task-panel")).toContainText(
    "needs your signature",
  );
});

test("deleting a filled field requires confirmation", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Try this sample" }).first().click();
  await page
    .getByRole("button", { name: "Continue to answers", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("DEMO DATA");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await page
    .getByRole("button", { name: "02 Check fields", exact: true })
    .click();
  await page.locator(".patch").first().focus();
  await page.keyboard.press("Enter");
  const count = await page.locator(".patch").count();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Delete field", exact: true }).click();
  await expect(page.locator(".patch")).toHaveCount(count);
});
