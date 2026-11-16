// Label normalisation (field-mapping Req 4.2): Unicode NFC, case folding, whitespace collapse,
// and removal of trailing punctuation such as ":" and "*".
//
// Case folding uses String.prototype.toLowerCase one code point at a time, so that a label and
// a long free-text answer are folded the same way and positions in the folded text can be
// mapped back to the original (see foldForSearch).

const WHITESPACE = /\s/u;
// Trailing characters dropped from a label: colon, asterisk, full stop, question mark, hyphen,
// the Devanagari danda and any whitespace between them.
const TRAILING_PUNCTUATION = /[\s:*.?\-\u0964]+$/u;

export interface FoldedText {
  /** Lower-cased text with every whitespace run replaced by one space. */
  folded: string;
  /** For each code unit of `folded`, its index in the input. Has one extra entry: the input length. */
  map: number[];
}

/**
 * Fold text for label search. The input should already be NFC. Each whitespace run becomes a
 * single space and every other code point is lower-cased; `map` links folded positions to the
 * input so a match can be cut out of the original text with its case intact.
 */
export function foldForSearch(text: string): FoldedText {
  let folded = '';
  const map: number[] = [];
  let index = 0;
  let inSpace = false;
  for (const ch of text) {
    if (WHITESPACE.test(ch)) {
      if (!inSpace) {
        folded += ' ';
        map.push(index);
        inSpace = true;
      }
    } else {
      const lower = ch.toLowerCase();
      folded += lower;
      for (let k = 0; k < lower.length; k += 1) map.push(index);
      inSpace = false;
    }
    index += ch.length;
  }
  map.push(text.length);
  return { folded, map };
}

/** Normalise a printed or spoken label for comparison (Req 4.2). */
export function normaliseLabel(s: string): string {
  return foldForSearch(s.normalize('NFC')).folded.trim().replace(TRAILING_PUNCTUATION, '');
}
