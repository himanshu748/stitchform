import { afterEach, expect, it, vi } from "vitest";
import { openCamera, stopCamera } from "./camera";
afterEach(() => vi.unstubAllGlobals());
it.each(["NotFoundError", "NotReadableError", "OverconstrainedError"])(
  "retries video without facingMode after %s",
  async (name) => {
    const stream = {} as MediaStream;
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("DEMO", name))
      .mockResolvedValueOnce(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    expect(await openCamera()).toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      video: true,
      audio: false,
    });
  },
);
it("does not retry a denied camera and offers upload", async () => {
  const getUserMedia = vi
    .fn()
    .mockRejectedValue(new DOMException("DEMO", "NotAllowedError"));
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  await expect(openCamera()).rejects.toThrow("Upload");
  expect(getUserMedia).toHaveBeenCalledOnce();
});
it("stops every camera track", () => {
  const a = vi.fn(),
    b = vi.fn();
  stopCamera({
    getTracks: () => [{ stop: a }, { stop: b }],
  } as unknown as MediaStream);
  expect(a).toHaveBeenCalledOnce();
  expect(b).toHaveBeenCalledOnce();
});
