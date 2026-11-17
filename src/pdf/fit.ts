export interface Fit {
  size: number;
  lines: string[];
  clipped: boolean;
}
export function fitText(
  text: string,
  width: number,
  height: number,
  measure: (s: string, size: number) => number,
): Fit {
  for (let size = 12; size >= 7; size--)
    if (measure(text, size) <= width)
      return { size, lines: [text], clipped: false };
  if (height >= 20) {
    const words = text.split(" ");
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
      if (lines.every((s) => measure(s, 7) <= width))
        return { size: 7, lines, clipped: false };
    }
  }
  let line = text;
  while (line && measure(line, 7) > width)
    line = Array.from(line).slice(0, -1).join("");
  return { size: 7, lines: [line], clipped: true };
}
