// Unit tests for generated and custom passphrases (stitch-code task 7, Req 1.1 to 1.5). The
// rejection sampling is checked with scripted random values, exhaustively over all 65,536
// 16-bit draws. Lists are the bundled files in public/wordlists/; the custom passphrases are
// SAMPLE / DEMO DATA.

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as publicApi from './index';
import messagesEn from './messages.en.json';
import messagesHi from './messages.hi.json';
import {
  ACCEPT_BELOW,
  COMMON_PASSWORDS_PATH,
  MAX_DRAWS_PER_WORD,
  MIN_PASSPHRASE_LENGTH,
  PASSPHRASE_WORDS,
  WORD_LIST_PATH,
  WORD_LIST_SIZE,
  checkCustomPassphrase,
  commonPasswordKey,
  generatePassphrase,
  parseCommonPasswords,
  parseWordList,
  passphraseLength,
  passphraseMessage,
  pickWordIndex,
  type PassphraseProblem,
  type RandomFill,
} from './passphrase';

function bundled(path: string): string {
  return readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8');
}

const wordListText = bundled(WORD_LIST_PATH);
const words = parseWordList(wordListText);
const common = parseCommonPasswords(bundled(COMMON_PASSWORDS_PATH));

afterEach(() => {
  vi.restoreAllMocks();
});

/** A fill function that hands out the given 16-bit values in order and counts its calls. */
function scripted(values: readonly number[]): RandomFill & { calls: number } {
  const fill = Object.assign(
    (array: Uint16Array<ArrayBuffer>) => {
      const value = values[fill.calls];
      if (value === undefined) throw new Error('scripted random values ran out');
      array[0] = value;
      fill.calls += 1;
    },
    { calls: 0 },
  );
  return fill;
}

describe('parseWordList', () => {
  it('reads the bundled EFF list as 7,776 words in dice order', () => {
    expect(words).toHaveLength(WORD_LIST_SIZE);
    expect(words[0]).toBe('abacus');
    expect(words[WORD_LIST_SIZE - 1]).toBe('zoom');
    expect(words).toContain('t-shirt');
  });

  it('accepts Windows line endings', () => {
    expect(parseWordList(wordListText.replaceAll('\n', '\r\n'))).toEqual(words);
  });

  it('rejects text of another shape, a short list and duplicate words', () => {
    expect(() => parseWordList('<!doctype html>\n<html></html>\n')).toThrow(/line 1/u);
    const lines = wordListText.trimEnd().split('\n');
    expect(() => parseWordList(lines.slice(1).join('\n'))).toThrow(/7776 distinct words, found 7775/u);
    const duplicated = [lines[0], lines[0]?.replace('11111', '11112'), ...lines.slice(2)].join('\n');
    expect(() => parseWordList(duplicated)).toThrow(/distinct/u);
  });
});

describe('parseCommonPasswords', () => {
  it('reads the bundled SecLists list as 10,001 lower-case keys', () => {
    expect(common.size).toBe(10_001);
    expect(common.has('password')).toBe(true);
    expect(common.has('films+pic+galeries')).toBe(true);
  });

  it('stores entries trimmed, NFC-normalised and in lower case', () => {
    const keys = parseCommonPasswords(' PassWord \r\nCafe\u0301 Latte\n\n');
    expect([...keys]).toEqual(['password', 'caf\u00e9 latte']);
    expect(commonPasswordKey('  CAFE\u0301 LATTE')).toBe('caf\u00e9 latte');
  });

  it('refuses an empty list', () => {
    expect(() => parseCommonPasswords('\n \n')).toThrow(/empty/u);
  });
});

describe('pickWordIndex (rejection sampling, Req 1.1)', () => {
  it('maps every accepted 16-bit value to value % 7,776 and redraws on the rest', () => {
    const hits = new Array<number>(WORD_LIST_SIZE).fill(0);
    const wrong: number[] = [];
    let rejected = 0;
    for (let value = 0; value <= 0xffff; value += 1) {
      const fill = scripted([value, 4321]);
      const index = pickWordIndex(fill);
      if (value < ACCEPT_BELOW) {
        if (index !== value % WORD_LIST_SIZE || fill.calls !== 1) wrong.push(value);
        hits[index] = (hits[index] ?? 0) + 1;
      } else {
        if (index !== 4321 || fill.calls !== 2) wrong.push(value);
        rejected += 1;
      }
    }
    expect(wrong).toEqual([]);
    // Every index is reached by exactly 8 of the 62,208 accepted values, so each word has
    // probability 1/7,776 when the 16-bit draws are uniform.
    expect(ACCEPT_BELOW).toBe(8 * WORD_LIST_SIZE);
    expect(hits.every((n) => n === 8)).toBe(true);
    expect(rejected).toBe(65_536 - ACCEPT_BELOW);
  });

  it('keeps drawing past several rejected values', () => {
    const fill = scripted([ACCEPT_BELOW, 0xffff, 65_000, ACCEPT_BELOW - 1]);
    expect(pickWordIndex(fill)).toBe(WORD_LIST_SIZE - 1);
    expect(fill.calls).toBe(4);
  });

  it('fails instead of looping for ever when the source never gives an accepted value', () => {
    const fill = scripted(new Array<number>(MAX_DRAWS_PER_WORD).fill(0xffff));
    expect(() => pickWordIndex(fill)).toThrow(/outside the accepted range/u);
    expect(fill.calls).toBe(MAX_DRAWS_PER_WORD);
  });

  it('zeroes the draw buffer it hands to the source', () => {
    let seen: Uint16Array<ArrayBuffer> | undefined;
    pickWordIndex((array) => {
      seen = array;
      array[0] = 1234;
    });
    expect(seen?.[0]).toBe(0);
  });
});

describe('generatePassphrase', () => {
  it('joins five words picked by the scripted draws, rejected draws skipped (Req 1.1)', () => {
    const fill = scripted([0, 0xffff, 7775, 7776, ACCEPT_BELOW, 62_207, 15_553]);
    expect(generatePassphrase(words, fill)).toBe(['abacus', 'zoom', 'abacus', 'zoom', words[1]].join(' '));
    expect(fill.calls).toBe(7);
  });

  it('uses crypto.getRandomValues by default and gives five list words', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    const passphrase = generatePassphrase(words);
    expect(spy).toHaveBeenCalled();
    const picked = passphrase.split(' ');
    expect(picked).toHaveLength(PASSPHRASE_WORDS);
    expect(picked.every((w) => words.includes(w))).toBe(true);
  });

  it('gives a fresh passphrase each time it is asked (Req 1.2)', () => {
    // Two equal results from a working source have probability 1 / 7776^5, about 2^-64.6.
    const seen = new Set(Array.from({ length: 20 }, () => generatePassphrase(words)));
    expect(seen.size).toBe(20);
  });

  it('always meets the custom passphrase rules, even with the shortest words', () => {
    const shortest = Math.min(...words.map((w) => w.length));
    expect(shortest * PASSPHRASE_WORDS + PASSPHRASE_WORDS - 1).toBeGreaterThanOrEqual(MIN_PASSPHRASE_LENGTH);
    expect(checkCustomPassphrase(generatePassphrase(words), common)).toEqual({ ok: true });
  });

  it('refuses a list that is not 7,776 distinct words without spaces', () => {
    expect(() => generatePassphrase(words.slice(1))).toThrow(RangeError);
    expect(() => generatePassphrase([...words.slice(1), 'zoom'])).toThrow(RangeError);
    expect(() => generatePassphrase([...words.slice(1), 'two words'])).toThrow(RangeError);
  });
});

describe('checkCustomPassphrase', () => {
  const repeat = (s: string, n: number): string => s.repeat(n);

  it('needs at least 16 characters after trimming (Req 1.3)', () => {
    expect(checkCustomPassphrase(repeat('a', 15), common)).toEqual({ ok: false, code: 'passphrase-too-short' });
    expect(checkCustomPassphrase(repeat('a', 16), common)).toEqual({ ok: true });
    expect(checkCustomPassphrase(`   ${repeat('b', 15)}\t \n`, common)).toEqual({ ok: false, code: 'passphrase-too-short' });
    expect(checkCustomPassphrase('  hollow lantern stitch  ', common)).toEqual({ ok: true });
  });

  it('counts after NFC, so a decomposed accent is one character (Req 1.3)', () => {
    const decomposed = 'e\u0301';
    expect(passphraseLength(repeat(decomposed, 16))).toBe(16);
    expect(checkCustomPassphrase(repeat(decomposed, 15), common)).toEqual({ ok: false, code: 'passphrase-too-short' });
    expect(checkCustomPassphrase(repeat(decomposed, 16), common)).toEqual({ ok: true });
  });

  it('counts code points, so a character outside the BMP is one character', () => {
    const thread = '\u{1F9F5}';
    expect(passphraseLength(repeat(thread, 8))).toBe(8);
    expect(checkCustomPassphrase(repeat(thread, 8), common)).toEqual({ ok: false, code: 'passphrase-too-short' });
    expect(checkCustomPassphrase(repeat(thread, 16), common)).toEqual({ ok: true });
    expect(passphraseLength('मेरा नाम')).toBe(Array.from('मेरा नाम').length);
  });

  it('rejects an entry of the bundled list in any case and with spaces around it (Req 1.4)', () => {
    for (const p of ['films+pic+galeries', 'FILMS+PIC+GALERIES', '  Films+Pic+Galeries\n']) {
      expect(checkCustomPassphrase(p, common)).toEqual({ ok: false, code: 'passphrase-common' });
    }
    expect(checkCustomPassphrase('films+pic+galeries!', common)).toEqual({ ok: true });
  });

  it('rejects a long entry of any list built by parseCommonPasswords (Req 1.4)', () => {
    const demoList = parseCommonPasswords('Correct Horse Battery Staple\nhollowbrook hostel 2026\n');
    expect(checkCustomPassphrase('correct horse battery staple', demoList)).toEqual({ ok: false, code: 'passphrase-common' });
    expect(checkCustomPassphrase('HOLLOWBROOK HOSTEL 2026', demoList)).toEqual({ ok: false, code: 'passphrase-common' });
    expect(checkCustomPassphrase('hollowbrook hostel 2027', demoList)).toEqual({ ok: true });
  });

  it('reports the length rule first, so short common passwords say too short', () => {
    expect(common.has('password')).toBe(true);
    expect(checkCustomPassphrase('password', common)).toEqual({ ok: false, code: 'passphrase-too-short' });
  });
});

describe('passphrase privacy (Req 1.5)', () => {
  it('never logs or returns the passphrase', () => {
    const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
    const spies = methods.map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const custom = 'demo lantern under the hollow brook';
    const results = [
      checkCustomPassphrase(custom, common),
      checkCustomPassphrase('short demo', common),
      checkCustomPassphrase('films+pic+galeries', common),
    ];
    const generated = generatePassphrase(words);
    for (const result of results) expect(JSON.stringify(result)).not.toContain('demo');
    expect(JSON.stringify(results)).not.toContain('galeries');
    expect(generated.split(' ')).toHaveLength(PASSPHRASE_WORDS);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('passphraseMessage', () => {
  const codes: PassphraseProblem[] = ['passphrase-too-short', 'passphrase-common'];

  it('has a plain English and Hindi message for every code, and nothing else', () => {
    expect(Object.keys(messagesEn).sort()).toEqual([...codes].sort());
    expect(Object.keys(messagesHi).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      for (const lang of ['en', 'hi'] as const) {
        const text = passphraseMessage(code, lang);
        expect(text.length).toBeGreaterThan(20);
        expect(text).not.toContain('\u2014');
      }
      expect(passphraseMessage(code, 'hi')).toMatch(/[\u0900-\u097F]/u);
    }
    expect(passphraseMessage('passphrase-too-short', 'en')).toContain(String(MIN_PASSPHRASE_LENGTH));
    expect(passphraseMessage('passphrase-too-short', 'hi')).toContain(String(MIN_PASSPHRASE_LENGTH));
  });
});

describe('public API', () => {
  it('re-exports the passphrase functions the passphrase dialog needs', () => {
    expect(publicApi.generatePassphrase).toBe(generatePassphrase);
    expect(publicApi.checkCustomPassphrase).toBe(checkCustomPassphrase);
    expect(publicApi.WORD_LIST_PATH).toBe('wordlists/eff_large_wordlist.txt');
    expect(publicApi.COMMON_PASSWORDS_PATH).toBe('wordlists/common-passwords.txt');
  });
});
