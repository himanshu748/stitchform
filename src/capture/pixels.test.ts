import { expect, it } from "vitest";
import { greyscale, stretchContrast } from "./pixels";
it("greyscale preserves alpha and does not mutate the source", () => {
  const p = new Uint8ClampedArray([50, 100, 150, 255]);
  const q = greyscale(p);
  expect(q[0]).toBe(q[1]);
  expect(q[1]).toBe(q[2]);
  expect(q[3]).toBe(255);
  expect(p[0]).toBe(50);
});
it("stretches monotonic tones including a constant image", () => {
  expect([
    ...stretchContrast(
      new Uint8ClampedArray([50, 50, 50, 255, 100, 100, 100, 255]),
    ),
  ]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  expect(stretchContrast(new Uint8ClampedArray([50, 50, 50, 255]))[0]).toBe(50);
});
