// Hindi number words 0 to 99 (validation Req 1.3), hand-written for Stitchform. Common
// alternative spellings are listed after the first one. Words are compared after
// foldDevanagari, so spellings that differ only by nukta or by chandrabindu versus anusvara
// (पाँच / पांच, अड़तीस / अडतीस) match without being listed twice.

/** HINDI_NUMBER_WORDS[n] lists the words for n. */
export const HINDI_NUMBER_WORDS: readonly (readonly string[])[] = [
  ['शून्य'],
  ['एक'],
  ['दो'],
  ['तीन'],
  ['चार'],
  ['पाँच'],
  ['छह', 'छः', 'छे', 'छै'],
  ['सात'],
  ['आठ'],
  ['नौ'],
  ['दस'],
  ['ग्यारह'],
  ['बारह'],
  ['तेरह'],
  ['चौदह'],
  ['पंद्रह', 'पन्द्रह'],
  ['सोलह'],
  ['सत्रह'],
  ['अठारह'],
  ['उन्नीस'],
  ['बीस'],
  ['इक्कीस'],
  ['बाईस'],
  ['तेईस'],
  ['चौबीस'],
  ['पच्चीस'],
  ['छब्बीस'],
  ['सत्ताईस'],
  ['अट्ठाईस', 'अठाईस'],
  ['उनतीस', 'उन्तीस'],
  ['तीस'],
  ['इकतीस', 'इकत्तीस'],
  ['बत्तीस'],
  ['तैंतीस', 'तेतीस'],
  ['चौंतीस', 'चौतीस'],
  ['पैंतीस'],
  ['छत्तीस'],
  ['सैंतीस'],
  ['अड़तीस'],
  ['उनतालीस', 'उन्तालीस'],
  ['चालीस'],
  ['इकतालीस'],
  ['बयालीस'],
  ['तैंतालीस', 'तेंतालीस'],
  ['चवालीस', 'चौवालीस'],
  ['पैंतालीस'],
  ['छियालीस'],
  ['सैंतालीस'],
  ['अड़तालीस'],
  ['उनचास'],
  ['पचास'],
  ['इक्यावन'],
  ['बावन'],
  ['तिरेपन', 'तिरपन'],
  ['चौवन', 'चौअन'],
  ['पचपन'],
  ['छप्पन'],
  ['सत्तावन'],
  ['अट्ठावन', 'अठावन'],
  ['उनसठ'],
  ['साठ'],
  ['इकसठ'],
  ['बासठ'],
  ['तिरसठ', 'तिरेसठ'],
  ['चौंसठ'],
  ['पैंसठ'],
  ['छियासठ'],
  ['सड़सठ', 'सरसठ'],
  ['अड़सठ'],
  ['उनहत्तर'],
  ['सत्तर'],
  ['इकहत्तर'],
  ['बहत्तर'],
  ['तिहत्तर'],
  ['चौहत्तर'],
  ['पचहत्तर'],
  ['छिहत्तर'],
  ['सतहत्तर'],
  ['अठहत्तर'],
  ['उनासी', 'उन्यासी'],
  ['अस्सी'],
  ['इक्यासी'],
  ['बयासी'],
  ['तिरासी'],
  ['चौरासी'],
  ['पचासी'],
  ['छियासी'],
  ['सत्तासी'],
  ['अट्ठासी'],
  ['नवासी'],
  ['नब्बे'],
  ['इक्यानवे'],
  ['बानवे'],
  ['तिरानवे'],
  ['चौरानवे'],
  ['पचानवे', 'पंचानवे'],
  ['छियानवे'],
  ['सत्तानवे'],
  ['अट्ठानवे'],
  ['निन्यानवे', 'निन्यानबे'],
];

/** "सौ" (hundred) and "हज़ार" (thousand), compared after foldDevanagari. */
export const HINDI_HUNDRED = 'सौ';
export const HINDI_THOUSAND = 'हज़ार';

/**
 * Comparison key for Devanagari words: NFC, nukta (U+093C) removed, chandrabindu (U+0901)
 * written as anusvara (U+0902), lower-cased (for any Latin letters).
 */
export function foldDevanagari(s: string): string {
  return s.normalize('NFC').replace(/\u093c/gu, '').replace(/\u0901/gu, '\u0902').toLowerCase();
}

const VALUE_BY_WORD = new Map<string, number>();
HINDI_NUMBER_WORDS.forEach((words, n) => {
  for (const w of words) VALUE_BY_WORD.set(foldDevanagari(w), n);
});

/** The value 0 to 99 of one Hindi number word, or null. */
export function parseHindiNumber(word: string): number | null {
  return VALUE_BY_WORD.get(foldDevanagari(word.trim())) ?? null;
}
