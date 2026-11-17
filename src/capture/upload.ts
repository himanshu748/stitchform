import { greyscale, stretchContrast } from "./pixels";
export function toWorkingCanvas(
  image: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  if (!width || !height || width * height > 50_000_000)
    throw new Error(
      "This image is too large or has no readable pixels. Use a smaller photo.",
    );
  const scale = 2000 / Math.max(width, height),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Image processing is unavailable.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  data.data.set(stretchContrast(greyscale(data.data)));
  ctx.putImageData(data, 0, 0);
  return canvas;
}
export async function readImageFile(file: File): Promise<HTMLCanvasElement> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error(
      "Use a PNG, JPEG or WebP photo. PDF upload is not available in v1; try a sample.",
    );
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Use an image under 20 MB.");
  const image = await createImageBitmap(file);
  try {
    return toWorkingCanvas(image, image.width, image.height);
  } finally {
    image.close();
  }
}
