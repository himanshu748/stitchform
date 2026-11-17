import type { BBox } from "../form-model";
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function toPdfRect(b: BBox, w: number, h: number): Rect {
  return {
    x: b.x * w,
    y: (1 - b.y - b.h) * h,
    width: b.w * w,
    height: b.h * h,
  };
}
export function fromPdfRect(r: Rect, w: number, h: number): BBox {
  return {
    x: r.x / w,
    y: 1 - (r.y + r.height) / h,
    w: r.width / w,
    h: r.height / h,
  };
}
