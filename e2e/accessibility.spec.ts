import { expect, test } from "@playwright/test";

test("Hindi field editing uses translated types and new-field defaults", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Language", { exact: true }).selectOption("hi");
  await page.getByRole("button", { name: "यह नमूना आज़माएँ" }).first().click();
  const type = page.getByLabel("उत्तर का प्रकार", { exact: true });
  await expect(type.locator("option")).toHaveText([
    "लिखित उत्तर",
    "तारीख़",
    "संख्या",
    "एक विकल्प चुनें",
    "हाँ या नहीं",
    "हस्ताक्षर",
    "तस्वीर",
  ]);
  await page.getByRole("button", { name: "खाना जोड़ें", exact: true }).click();
  await expect(page.getByLabel("खाने का नाम", { exact: true })).toHaveValue(
    "नया खाना",
  );
  await type.selectOption("choice");
  await expect(
    page.getByLabel("विकल्प, अल्पविराम से अलग", { exact: true }),
  ).toHaveValue("विकल्प 1, विकल्प 2");
});

for (const lang of ["en", "hi"] as const) {
  test(`${lang} stitch code has an accessible description and recovery warnings`, async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    if (lang === "hi") {
      await page.setViewportSize({ width: 320, height: 850 });
      await page.getByLabel("Language", { exact: true }).selectOption("hi");
      expect(
        (await page.getByLabel("भाषा", { exact: true }).boundingBox())!.width,
      ).toBeGreaterThanOrEqual(80);
    }
    await page
      .getByRole("button", {
        name: lang === "en" ? "Try this sample" : "यह नमूना आज़माएँ",
      })
      .first()
      .click();
    await page
      .getByRole("button", {
        name: lang === "en" ? "05 Print and save" : "05 प्रिंट और सहेजें",
        exact: true,
      })
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    const section = page.locator(".stitch-panel");
    await expect(section).toContainText(
      lang === "en"
        ? "Keep the code and passphrase apart"
        : "कोड और पासफ़्रेज़ अलग रखें",
    );
    await expect(section).toContainText(
      lang === "en" ? "cannot be recovered" : "वापस नहीं मिल सकते",
    );
    await page
      .getByLabel(lang === "en" ? "Passphrase" : "पासफ़्रेज़", { exact: true })
      .fill("DEMO DATA accessibility passphrase");
    await page
      .getByRole("button", {
        name: lang === "en" ? "Make stitch code" : "स्टिच कोड बनाएँ",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("img", {
        name:
          lang === "en"
            ? /QR stitch code containing encrypted answers/
            : /स्टिच QR कोड जिसमें एन्क्रिप्ट किए उत्तर हैं/,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`stitch-code-${lang}.png`),
      fullPage: true,
    });
    await page
      .getByRole("banner")
      .getByRole("button", {
        name: lang === "en" ? "Privacy" : "गोपनीयता",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      lang === "en" ? "stitch code to keep text answers" : "केवल लिखे उत्तर",
    );
    await expect(dialog).toContainText(
      lang === "en" ? "permission before sending" : "अलग अनुमति",
    );
  });
}
