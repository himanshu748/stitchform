// Checks on the bundled word lists in public/wordlists/ (stitch-code task 6, Req 1.1 and 1.4).
// Both files are copied byte for byte from their sources, so their SHA-256 must match the
// values recorded in README "Pre-existing work". Licences: EFF large wordlist CC BY 4.0,
// SecLists MIT (its licence text is bundled next to the list).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function bundled(name: string): Buffer {
  return readFileSync(new URL(`../../public/wordlists/${name}`, import.meta.url));
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function lines(bytes: Buffer): string[] {
  const text = bytes.toString('utf8');
  expect(text.endsWith('\n')).toBe(true);
  return text.slice(0, -1).split('\n');
}

describe('EFF large wordlist', () => {
  const bytes = bundled('eff_large_wordlist.txt');

  it('is the unchanged file from eff.org', () => {
    expect(sha256(bytes)).toBe('addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e');
  });

  it('has 7,776 lines, one per five-dice roll in order, with distinct words and no spaces', () => {
    const rows = lines(bytes).map((line) => line.split('\t'));
    expect(rows).toHaveLength(7776);
    const rolls: string[] = [];
    for (let i = 0; i < 7776; i += 1) {
      rolls.push(i.toString(6).padStart(5, '0').replace(/\d/gu, (d) => String(Number(d) + 1)));
    }
    expect(rows.map((r) => r[0])).toEqual(rolls);
    const words = rows.map((r) => r[1] ?? '');
    expect(rows.every((r) => r.length === 2)).toBe(true);
    expect(words.every((w) => /^[a-z][a-z-]*$/u.test(w))).toBe(true);
    expect(new Set(words).size).toBe(7776);
  });
});

describe('SecLists 10k-most-common list', () => {
  const bytes = bundled('common-passwords.txt');

  it('is the unchanged file from SecLists commit 913b327', () => {
    expect(sha256(bytes)).toBe('68782d6a4a19a4768d5f15dd66bd534e7a33055cc755411e33f16d18c50fdcce');
  });

  it('has 10,001 distinct, non-empty entries', () => {
    const entries = lines(bytes);
    expect(entries).toHaveLength(10_001);
    expect(entries.every((e) => e.trim() !== '' && !e.includes('\r'))).toBe(true);
    expect(new Set(entries).size).toBe(10_001);
  });

  it('ships with the SecLists MIT licence text', () => {
    const licence = bundled('SecLists-LICENSE.txt').toString('utf8');
    expect(licence.startsWith('MIT License')).toBe(true);
    expect(licence).toContain('Copyright (c) 2018 Daniel Miessler');
  });
});
