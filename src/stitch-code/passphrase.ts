// Passphrases for stitch codes (stitch-code Req 1.1 to 1.5). Pure: no DOM, no fetch, no storage.
// The browser loads the two bundled lists from public/wordlists/ when the passphrase dialog
// opens and passes their text to parseWordList and parseCommonPasswords. Words are picked with
// crypto.getRandomValues (MDN Crypto.getRandomValues) through an injected fill function, so
// tests can script the random values. Nothing here logs, stores or returns a custom passphrase
// (Req 1.5).

import { normalisePassphrase } from './crypto';
import messagesEn from './messages.en.json';
import messagesHi from './messages.hi.json';

/** Words in the EFF large wordlist: one per roll of five dice (6^5). */
export const WORD_LIST_SIZE = 7776;
/** Words in a generated passphrase: log2(7776^5), about 64.6 bits (Req 1.1). */
export const PASSPHRASE_WORDS = 5;
/** Minimum length of a custom passphrase in Unicode code points, after NFC and trim (Req 1.3). */
export const MIN_PASSPHRASE_LENGTH = 16;
/** The bundled lists, relative to the app's base URL (files in public/). */
export const WORD_LIST_PATH = 'wordlists/eff_large_wordlist.txt';
export const COMMON_PASSWORDS_PATH = 'wordlists/common-passwords.txt';

/**
 * 8 x 7,776, the largest multiple of 7,776 that fits in 16 bits. A draw below it maps to an
 * index with value % 7,776, so each index has exactly 8 of the 62,208 accepted values; a draw
 * at or above it is thrown away (rejection sampling, Req 1.1: no modulo bias).
 */
export const ACCEPT_BELOW = 62_208;

/**
 * Draws allowed for one word. With a working random source a draw is rejected with probability
 * 3,328 / 65,536 (about 5%), so 64 rejections in a row (about 1 in 10^83) means the source is
 * broken, and failing beats looping for ever.
 */
export const MAX_DRAWS_PER_WORD = 64;

/** Fills the array with random values, as crypto.getRandomValues does. */
export type RandomFill = (array: Uint16Array<ArrayBuffer>) => void;

export const cryptoRandomFill: RandomFill = (array) => {
  crypto.getRandomValues(array);
};

/** Why a custom passphrase was refused; also the key of its message. */
export type PassphraseProblem = 'passphrase-too-short' | 'passphrase-common';
export type PassphraseCheck = { ok: true } | { ok: false; code: PassphraseProblem };

const WORD_LINE = /^[1-6]{5}\t(\S+)$/u;

function hasDistinctWords(words: readonly string[]): boolean {
  return words.length === WORD_LIST_SIZE && new Set(words).size === WORD_LIST_SIZE && words.every((w) => /^\S+$/u.test(w));
}

/**
 * Read the EFF large wordlist: lines of five dice digits, a tab and a word. Blank lines and a
 * trailing carriage return are allowed. Throws if a line has another shape (for example an HTML
 * error page) or if the result is not 7,776 distinct words.
 */
export function parseWordList(text: string): string[] {
  const words: string[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '') return;
    const match = WORD_LINE.exec(line);
    if (match === null) throw new Error(`word list line ${i + 1} is not "<five dice digits><tab><word>"`);
    words.push(match[1] ?? '');
  });
  if (!hasDistinctWords(words)) throw new Error(`word list must have ${WORD_LIST_SIZE} distinct words, found ${words.length}`);
  return words;
}

/** The form compared against the common-password list: normalised as for key derivation, then lower case (Req 1.4). */
export function commonPasswordKey(passphrase: string): string {
  return normalisePassphrase(passphrase).toLowerCase();
}

/** Read the common-password list, one entry per line, into the set that checkCustomPassphrase expects. */
export function parseCommonPasswords(text: string): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const line of text.split('\n')) {
    const key = commonPasswordKey(line);
    if (key !== '') keys.add(key);
  }
  if (keys.size === 0) throw new Error('common-password list is empty');
  return keys;
}

/**
 * Pick one index into the word list by rejection sampling: draw 16 bits, keep values below
 * ACCEPT_BELOW and return value % 7,776. The draw buffer is zeroed afterwards.
 */
export function pickWordIndex(fill: RandomFill): number {
  const draw = new Uint16Array(1);
  try {
    for (let i = 0; i < MAX_DRAWS_PER_WORD; i += 1) {
      fill(draw);
      const value = draw[0] ?? ACCEPT_BELOW;
      if (value < ACCEPT_BELOW) return value % WORD_LIST_SIZE;
    }
  } finally {
    draw.fill(0);
  }
  throw new Error(`random source returned ${MAX_DRAWS_PER_WORD} values in a row outside the accepted range`);
}

/**
 * A new generated passphrase: five words from the 7,776-word list, each chosen uniformly and
 * independently, separated by single spaces (Req 1.1). Every call draws fresh random values,
 * so asking again gives a new passphrase (Req 1.2).
 */
export function generatePassphrase(words: readonly string[], fill: RandomFill = cryptoRandomFill): string {
  if (!hasDistinctWords(words)) throw new RangeError(`generatePassphrase needs ${WORD_LIST_SIZE} distinct words without spaces`);
  const picked: string[] = [];
  for (let i = 0; i < PASSPHRASE_WORDS; i += 1) picked.push(words[pickWordIndex(fill)] ?? '');
  return picked.join(' ');
}

/**
 * Length of a passphrase as Req 1.3 counts it: Unicode code points after NFC and trimming.
 * Code points give the same count in every browser, unlike grapheme segmentation, which
 * depends on the engine's Unicode version. The UI uses this for its character counter.
 */
export function passphraseLength(passphrase: string): number {
  return Array.from(normalisePassphrase(passphrase)).length;
}

/**
 * Check a passphrase the user typed: at least 16 characters (Req 1.3), then not in the bundled
 * common-password list, compared in lower case (Req 1.4). `commonSet` must come from
 * parseCommonPasswords. The result never contains the passphrase.
 */
export function checkCustomPassphrase(passphrase: string, commonSet: ReadonlySet<string>): PassphraseCheck {
  if (passphraseLength(passphrase) < MIN_PASSPHRASE_LENGTH) return { ok: false, code: 'passphrase-too-short' };
  if (commonSet.has(commonPasswordKey(passphrase))) return { ok: false, code: 'passphrase-common' };
  return { ok: true };
}

const MESSAGES: Readonly<Record<'en' | 'hi', Readonly<Record<PassphraseProblem, string>>>> = {
  en: messagesEn,
  hi: messagesHi,
};

/** Plain message for a refused custom passphrase in English or Hindi (Req 1.4). Insert it as text. */
export function passphraseMessage(code: PassphraseProblem, lang: 'en' | 'hi'): string {
  return MESSAGES[lang][code];
}
