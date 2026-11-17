export function greyscale(pixels: Uint8ClampedArray): Uint8ClampedArray {
  const out = pixels.slice();
  for (let i = 0; i < out.length; i += 4) {
    const grey = Math.round(
      0.299 * out[i]! + 0.587 * out[i + 1]! + 0.114 * out[i + 2]!,
    );
    out[i] = out[i + 1] = out[i + 2] = grey;
  }
  return out;
}
export function stretchContrast(pixels: Uint8ClampedArray): Uint8ClampedArray {
  const out = pixels.slice();
  let lo = 255,
    hi = 0;
  for (let i = 0; i < out.length; i += 4) {
    lo = Math.min(lo, out[i]!);
    hi = Math.max(hi, out[i]!);
  }
  if (lo === hi) return out;
  for (let i = 0; i < out.length; i += 4)
    out[i] = out[i + 1] = out[i + 2] = ((out[i]! - lo) * 255) / (hi - lo);
  return out;
}
