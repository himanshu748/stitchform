import { expect, it } from "vitest";
import fc from "fast-check";
import { toPdfRect, fromPdfRect } from "./geometry";
import { fitText } from "./fit";
import { canEncodeWinAnsi } from "./winansi";
it("converts page fractions without leaving the page", () =>
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 0.5, noNaN: true }),
      fc.double({ min: 0, max: 0.5, noNaN: true }),
      (x, y) => {
        const b = { x, y, w: 0.4, h: 0.3 },
          r = toPdfRect(b, 595, 842),
          back = fromPdfRect(r, 595, 842);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(back.x).toBeCloseTo(x, 9);
        expect(back.y).toBeCloseTo(y, 9);
      },
    ),
  ));
it("fits text within bounds or reports clipping", () =>
  fc.assert(
    fc.property(fc.string(), (text) => {
      const fit = fitText(text, 40, 30, (s, n) => s.length * n * 0.5);
      expect(fit.size).toBeGreaterThanOrEqual(7);
      expect(fit.size).toBeLessThanOrEqual(12);
      expect(fit.lines.every((s) => s.length * fit.size * 0.5 <= 40)).toBe(
        true,
      );
    }),
  ));
it("routes Hindi through the canvas path", () =>
  fc.assert(
    fc.property(fc.integer({ min: 0x900, max: 0x97f }), (n) => {
      expect(canEncodeWinAnsi("name" + String.fromCharCode(n))).toBe(false);
    }),
  ));
