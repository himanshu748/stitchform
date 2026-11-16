// Devanagari and ASCII digit conversion (validation Req 1.2, 3.2). Devanagari digits are
// U+0966 (०) to U+096F (९). Every other character is left as it is.

const DEVANAGARI_ZERO = 0x0966;
const ASCII_ZERO = 0x30;

/** Replace Devanagari digits ०१२३४५६७८९ with ASCII 0123456789. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[\u0966-\u096f]/gu, (d) => String.fromCharCode(d.charCodeAt(0) - DEVANAGARI_ZERO + ASCII_ZERO));
}

/** Replace ASCII digits with Devanagari digits, for showing a value in the script the user typed. */
export function toDevanagariDigits(s: string): string {
  return s.replace(/[0-9]/gu, (d) => String.fromCharCode(d.charCodeAt(0) - ASCII_ZERO + DEVANAGARI_ZERO));
}

/** True when the text contains at least one Devanagari digit. */
export function hasDevanagariDigits(s: string): boolean {
  return /[\u0966-\u096f]/u.test(s);
}
