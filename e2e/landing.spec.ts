import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("the landing page opens a scholarship sample and leads to a PDF", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fill a paper form from a photo." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A paper form leaves you guessing." })).toBeAttached();
  const exampleImages = page.locator("figure img");
  await expect(exampleImages).toHaveCount(2);
  for (const image of await exampleImages.all()) {
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  const sample = page.getByRole("link", { name: "Try the scholarship sample" }).first();
  await sample.focus();
  await expect(sample).toBeFocused();
  await sample.press("Enter");
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByRole("heading", { name: "Check detected fields" })).toBeFocused();
  await expect(page.getByRole("heading", { name: /Moonfield Merit Scholarship Trust/ })).toBeVisible();
  await page.getByRole("button", { name: "Continue to answers" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Asha Willow");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await page.getByLabel("Date of birth", { exact: true }).fill("5 March 2004");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await expect(page.locator(".task-panel")).toContainText("05/03/2004");

  await page.getByRole("button", { name: "Continue to print and save" }).click();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Make and download PDF" }).click();
  const pdfPath = await (await pdfDownload).path();
  expect(pdfPath).toBeTruthy();
  const pdf = await PDFDocument.load(await readFile(pdfPath!));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getTitle()).toContain("SAMPLE / DEMO DATA");
});

test("a sample load failure leaves the form picker available", async ({ page }) => {
  await page.route("**/sample-moonfield-scholarship.template.json", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/");
  await page.getByRole("link", { name: "Try the scholarship sample" }).first().click();
  await expect(page.getByRole("heading", { name: "Open a form" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("The sample could not open");
  await expect(page.getByRole("button", { name: "Upload an image" })).toBeVisible();
  await page.getByRole("button", { name: "Try this sample" }).first().click();
  await expect(page.getByRole("heading", { name: /Lantern Hill College/ })).toBeVisible();
});
