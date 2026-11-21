import { test, expect } from "@playwright/test";

async function answerFirstField(page: import("@playwright/test").Page) {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Try this sample" }).first().click();
  await page
    .getByRole("button", { name: "Continue to answers", exact: true })
    .click();
}

test("voice needs consent and stops when moving to another field", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { started: 0, aborted: 0 };
    const host = window as unknown as {
      voiceTest: typeof state;
      SpeechRecognition: unknown;
    };
    host.voiceTest = state;
    host.SpeechRecognition = class {
      static available = async () => "unavailable";
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        state.started++;
      }
      abort() {
        state.aborted++;
        this.onend?.();
      }
    };
  });
  await answerFirstField(page);
  await page
    .getByRole("button", { name: "Speak an answer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { voiceTest: { started: number } }).voiceTest
          .started,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "I agree, enable voice" }).click();
  await expect(
    page.getByRole("button", { name: "Stop listening" }),
  ).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Asha Willow");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await expect(page.getByLabel("Date of birth", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { voiceTest: { aborted: number } }).voiceTest
          .aborted,
    ),
  ).toBeGreaterThan(0);
  await expect(page.locator("#voice-status")).toHaveCount(0);
});

test("a passphrase edit invalidates encryption already in progress", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const native = crypto.subtle.deriveKey.bind(crypto.subtle);
    const host = window as unknown as {
      releaseStitchKey?: () => void;
      stitchKeyWaiting?: boolean;
    };
    crypto.subtle.deriveKey = async (
      ...args: Parameters<SubtleCrypto["deriveKey"]>
    ) => {
      const key = await native(...args);
      host.stitchKeyWaiting = true;
      await new Promise<void>((resolve) => {
        host.releaseStitchKey = resolve;
      });
      return key;
    };
  });
  await answerFirstField(page);
  await page.getByLabel("Full name", { exact: true }).fill("Asha Willow");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await page
    .getByRole("button", { name: "05 Print and save", exact: true })
    .click();
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("DEMO DATA initial passphrase");
  await page
    .getByRole("button", { name: "Make stitch code", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { stitchKeyWaiting?: boolean })
            .stitchKeyWaiting,
      ),
    )
    .toBe(true);
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("DEMO DATA changed passphrase");
  await page.evaluate(() =>
    (window as unknown as { releaseStitchKey: () => void }).releaseStitchKey(),
  );
  await expect(page.getByRole("status")).not.toContainText(
    "Locking your answers",
  );
  await expect(
    page.getByRole("link", { name: "Download QR image" }),
  ).toHaveCount(0);
});

test("an OCR preparation failure keeps the uploaded page for manual correction", async ({
  page,
}) => {
  await page.route("**/samples/*.template.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/app/");
  await page
    .locator("main input[type=file]")
    .setInputFiles("public/samples/sample-hollowbrook-hostel.png");
  await expect(
    page.getByRole("heading", { name: "Check detected fields" }),
  ).toBeVisible();
  await expect(page.locator(".document > img")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Add a field", exact: true }),
  ).toBeVisible();
});

async function holdSignatureConversion(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.toBlob;
    const host = window as unknown as {
      signatureWaiting?: boolean;
      releaseSignature?: () => void;
    };
    HTMLCanvasElement.prototype.toBlob = function (
      callback: BlobCallback,
      type?: string,
      quality?: number,
    ) {
      const canvas = this;
      native.call(
        canvas,
        (blob) => {
          if (canvas.classList.contains("signature-pad")) {
            host.signatureWaiting = true;
            host.releaseSignature = () => callback(blob);
          } else callback(blob);
        },
        type,
        quality,
      );
    };
  });
}

async function drawTestSignature(page: import("@playwright/test").Page) {
  await page.locator('.patch[data-field-id="signature"]').click();
  const canvas = page.locator(".signature-pad");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  // Synthetic test stroke, never a generated signature in the application.
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 60, { steps: 3 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { signatureWaiting?: boolean })
            .signatureWaiting,
      ),
    )
    .toBe(true);
}

test("clearing a drawn signature also cancels its pending PNG conversion", async ({
  page,
}) => {
  await holdSignatureConversion(page);
  await answerFirstField(page);
  await drawTestSignature(page);
  await page
    .getByRole("button", { name: "Clear signature", exact: true })
    .click();
  await page.evaluate(() =>
    (window as unknown as { releaseSignature: () => void }).releaseSignature(),
  );
  await page
    .getByRole("button", { name: "Review answers", exact: true })
    .click();
  const row = page.locator(".review-row").filter({ hasText: "Signature" });
  await expect(row).toContainText("Not answered");
  await expect(row).toContainText("needs your signature");
});

test("finishing a pending signature invalidates displayed exports", async ({
  page,
}) => {
  await holdSignatureConversion(page);
  await answerFirstField(page);
  await drawTestSignature(page);
  await page
    .getByRole("button", { name: "05 Print and save", exact: true })
    .click();
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("DEMO DATA export passphrase");
  await page
    .getByRole("button", { name: "Make stitch code", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Download QR image" }),
  ).toBeVisible();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Make and download PDF", exact: true })
    .click();
  await event;
  await expect(
    page.getByRole("link", { name: "Open PDF for printing" }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { releaseSignature: () => void }).releaseSignature(),
  );
  await expect(
    page.getByRole("link", { name: "Download QR image" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open PDF for printing" }),
  ).toHaveCount(0);
});

test(".stitch rejects a wrong passphrase and closing unlock prevents a late refill", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const native = crypto.subtle.decrypt.bind(crypto.subtle);
    const host = window as unknown as {
      unlockWaiting?: boolean;
      releaseUnlock?: () => void;
    };
    crypto.subtle.decrypt = async (
      ...args: Parameters<SubtleCrypto["decrypt"]>
    ) => {
      const bytes = await native(...args);
      host.unlockWaiting = true;
      await new Promise<void>((resolve) => {
        host.releaseUnlock = resolve;
      });
      return bytes;
    };
  });
  await answerFirstField(page);
  await page.getByLabel("Full name", { exact: true }).fill("Asha Willow");
  await page.getByRole("button", { name: "Save answer and next" }).click();
  await page
    .getByRole("button", { name: "05 Print and save", exact: true })
    .click();
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("DEMO DATA stitch file passphrase");
  await page
    .getByRole("button", { name: "Make stitch code", exact: true })
    .click();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .stitch file", exact: true })
    .click();
  const file = await event;
  const filePath = testInfo.outputPath("demo-answers.stitch");
  await file.saveAs(filePath);
  await page.reload();
  await page
    .getByRole("button", { name: "Open a stitch code", exact: true })
    .click();
  await page.getByLabel("QR image or .stitch file").setInputFiles(filePath);
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("DEMO DATA wrong passphrase");
  await page.getByRole("button", { name: "Unlock and refill" }).click();
  await expect(page.getByRole("dialog")).toContainText("could not be opened");
  await expect(page.locator(".task-panel")).toHaveCount(0);
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("DEMO DATA stitch file passphrase");
  await page.getByRole("button", { name: "Unlock and refill" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { unlockWaiting?: boolean }).unlockWaiting,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() =>
    (window as unknown as { releaseUnlock: () => void }).releaseUnlock(),
  );
  await expect(
    page.getByRole("heading", { name: "Open a form" }),
  ).toBeVisible();
  await expect(page.locator(".task-panel")).toHaveCount(0);
});

async function tabTo(page: import("@playwright/test").Page, name: string) {
  for (let i = 0; i < 120; i++) {
    const active = await page.evaluate(
      () =>
        document.activeElement?.getAttribute("aria-label") ??
        document.activeElement?.textContent?.trim(),
    );
    if (active === name) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Could not reach ${name} with Tab`);
}
async function activate(page: import("@playwright/test").Page, name: string) {
  await tabTo(page, name);
  await page.keyboard.press("Enter");
}

test("the typed sample-to-PDF journey can be completed using only the keyboard", async ({
  page,
}) => {
  await page.goto("/app/");
  await activate(page, "Try this sample");
  await expect(
    page.getByRole("heading", { name: "Check detected fields" }),
  ).toBeVisible();
  await activate(page, "Continue to answers");
  await tabTo(page, "Full name");
  await page.keyboard.insertText("Asha Willow");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("5 March 2004");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Ravi Willow");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("17 Demo Lane");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await activate(page, "Save answer and next");
  await page.keyboard.insertText("75");
  await page.keyboard.press("Enter");
  await activate(page, "Skip for now");
  await activate(page, "Skip for now");
  await activate(page, "Review answers");
  await expect(page.locator(".task-panel")).toContainText(
    "needs your signature",
  );
  await activate(page, "Continue to print and save");
  await expect(page.locator(".task-panel")).toContainText(
    "Some required fields still need attention",
  );
  const event = page.waitForEvent("download");
  await activate(page, "Make and download PDF");
  const pdf = await event;
  expect(pdf.suggestedFilename()).toBe("stitchform-filled.pdf");
});

test("a completed QR is removed when its passphrase is edited", async ({
  page,
}) => {
  await answerFirstField(page);
  await page
    .getByRole("button", { name: "05 Print and save", exact: true })
    .click();
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("DEMO DATA original passphrase");
  await page
    .getByRole("button", { name: "Make stitch code", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Download QR image" }),
  ).toBeVisible();
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("DEMO DATA replacement passphrase");
  await expect(
    page.getByRole("link", { name: "Download QR image" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Download .stitch file", exact: true }),
  ).toHaveCount(0);
});

test("leaving print while its background loads prevents a late PDF download", async ({
  page,
}) => {
  let release: () => void = () => {};
  let reportStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    reportStarted = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/samples/sample-lantern-hill-admission.pdf",
    async (route) => {
      reportStarted();
      await pending;
      await route.continue();
    },
  );
  await answerFirstField(page);
  await page
    .getByRole("button", { name: "05 Print and save", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Make and download PDF", exact: true })
    .click();
  await started;
  await page.getByRole("button", { name: "03 Answer", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Asha Willow");
  await page.getByLabel("Full name", { exact: true }).press("Tab");
  const lateDownload = page.waitForEvent("download", { timeout: 1000 }).then(
    () => true,
    (error) => {
      if (error instanceof Error && error.name === "TimeoutError") return false;
      throw error;
    },
  );
  release();
  expect(await lateDownload).toBe(false);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Asha Willow",
  );
});
