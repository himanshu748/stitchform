// English and Hindi month names (validation Req 1.3), hand-written for Stitchform. Hindi words
// are compared after foldDevanagari, so फ़रवरी and फरवरी both match.

import { foldDevanagari } from './hindi-numbers';

/** MONTH_NAMES[m - 1] lists the names for month m: English full and short forms, then Hindi. */
export const MONTH_NAMES: readonly (readonly string[])[] = [
  ['january', 'jan', 'जनवरी'],
  ['february', 'feb', 'फ़रवरी', 'फरवरी'],
  ['march', 'mar', 'मार्च'],
  ['april', 'apr', 'अप्रैल', 'अप्रेल'],
  ['may', 'मई'],
  ['june', 'jun', 'जून'],
  ['july', 'jul', 'जुलाई'],
  ['august', 'aug', 'अगस्त'],
  ['september', 'sep', 'sept', 'सितंबर', 'सितम्बर'],
  ['october', 'oct', 'अक्टूबर', 'अक्तूबर'],
  ['november', 'nov', 'नवंबर', 'नवम्बर'],
  ['december', 'dec', 'दिसंबर', 'दिसम्बर'],
];

const MONTH_BY_NAME = new Map<string, number>();
MONTH_NAMES.forEach((names, i) => {
  for (const name of names) MONTH_BY_NAME.set(foldDevanagari(name), i + 1);
});

/** Month number 1 to 12 for an English or Hindi month name or short form, or null. */
export function monthFromName(word: string): number | null {
  return MONTH_BY_NAME.get(foldDevanagari(word.trim()).replace(/\.$/u, '')) ?? null;
}
