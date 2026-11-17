const extras = new Set(
  Array.from("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ").map((c) => c.codePointAt(0)),
);
export function canEncodeWinAnsi(text: string): boolean {
  return Array.from(text).every((c) => {
    const n = c.codePointAt(0)!;
    return (n >= 32 && n <= 126) || (n >= 160 && n <= 255) || extras.has(n);
  });
}
