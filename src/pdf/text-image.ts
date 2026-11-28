let fontReady: Promise<void> | undefined;
export async function renderTextImage(
  text: string,
  width: number,
  height: number,
): Promise<Uint8Array<ArrayBuffer>> {
  fontReady ??= (async () => {
    const face = new FontFace(
      "Stitchform Devanagari",
      "url(../fonts/NotoSansDevanagari-Regular.ttf)",
    );
    await face.load();
    document.fonts.add(face);
  })();
  await fontReady;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * 3);
  canvas.height = Math.ceil(height * 3);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Text rendering is unavailable.");
  ctx.scale(3, 3);
  let size = 12;
  ctx.font = `${size}px "Stitchform Devanagari"`;
  while (size > 7 && ctx.measureText(text).width > width) {
    size -= 0.5;
    ctx.font = `${size}px "Stitchform Devanagari"`;
  }
  ctx.fillStyle = "#132b24";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, height / 2, width);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Text rendering failed."))),
      "image/png",
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
