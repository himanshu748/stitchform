import { expect, it, vi } from "vitest";
import { startVoice, type RecognitionInstance } from "./index";
it("never creates a microphone session without confirmation", async () => {
  const ctor = vi.fn();
  await expect(
    startVoice(
      {
        lang: "en",
        confirmed: false,
        offerInstall: async () => false,
        onText: vi.fn(),
        onError: vi.fn(),
        onEnd: vi.fn(),
      },
      ctor as never,
    ),
  ).rejects.toThrow("consent");
  expect(ctor).not.toHaveBeenCalled();
});
it("uses local recognition only when the language is reported available", async () => {
  const start = vi.fn(),
    abort = vi.fn();
  let instance: RecognitionInstance;
  class Fake {
    static available = async () => "available";
    lang = "";
    interimResults = false;
    continuous = false;
    processLocally = false;
    onresult = null;
    onerror = null;
    onend = null;
    start = start;
    abort = abort;
    constructor() {
      instance = this;
    }
  }
  const result = await startVoice(
    {
      lang: "hi",
      confirmed: true,
      offerInstall: async () => false,
      onText: vi.fn(),
      onError: vi.fn(),
      onEnd: vi.fn(),
    },
    Fake,
  );
  expect(instance!.lang).toBe("hi-IN");
  expect(instance!.processLocally).toBe(true);
  expect(result.mode).toBe("on-device");
  result.stop();
  expect(abort).toHaveBeenCalledOnce();
});

it("does not start a delayed on-device availability check after cancellation", async () => {
  const controller = new AbortController(),
    start = vi.fn();
  class Delayed {
    static available = async () => {
      controller.abort();
      return "available";
    };
    lang = "";
    interimResults = false;
    continuous = false;
    onresult = null;
    onerror = null;
    onend = null;
    start = start;
    abort = vi.fn();
  }
  await expect(
    startVoice(
      {
        lang: "en",
        confirmed: true,
        signal: controller.signal,
        offerInstall: async () => false,
        onText: vi.fn(),
        onError: vi.fn(),
        onEnd: vi.fn(),
      },
      Delayed,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(start).not.toHaveBeenCalled();
});
