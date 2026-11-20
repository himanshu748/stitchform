export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const rgb = hex
      .replace("#", "")
      .match(/../g)!
      .map((s) => parseInt(s, 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export const colours = {
  paper: "#f5f7fb",
  ink: "#1b2941",
  muted: "#4d5d76",
  thread: "#b8cbff",
  dark: "#172238",
  warning: "#865315",
  border: "#7989a4",
};
