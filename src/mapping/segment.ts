// Free-text segmentation (field-mapping Req 4.1, 4.3): find the form's labels and their
// synonyms inside one answer, cut the answer into label and value pieces, and match each piece
// to at most one field. Pieces that match no single field go to `unmatched`.

import type { FormField } from '../form-model';
import { foldForSearch, normaliseLabel } from './normalise-label';
import { connectorPhrases, synonymsFor } from './synonyms';

/** One searchable label of a form: a field's own label (exact) or one of its synonyms. */
export interface LabelEntry {
  label: string;
  fieldId: string;
  exact: boolean;
}

export interface Segment {
  fieldId: string;
  /** The normalised label that was found. */
  label: string;
  /** The value as written, with connectors and separators removed from its ends. */
  value: string;
}

export interface SegmentResult {
  segments: Segment[];
  unmatched: string[];
}

/** Searchable labels for a form: each field's normalised label plus its EN and HI synonyms. */
export function buildLabelIndex(fields: readonly FormField[]): LabelEntry[] {
  const entries: LabelEntry[] = [];
  for (const f of fields) {
    const exact = normaliseLabel(f.label);
    if (exact !== '') entries.push({ label: exact, fieldId: f.id, exact: true });
    for (const synonym of synonymsFor(f.label)) {
      if (synonym !== exact) entries.push({ label: synonym, fieldId: f.id, exact: false });
    }
  }
  return entries;
}

const WORD_CHAR = /^[\p{L}\p{M}\p{N}]/u;
const LEADING_SEPARATORS = /^[\s:=,;.\-]+/u;
const TRAILING_SEPARATORS = /[\s:=,;.!?\-\u0964]+$/u;
const WORD_PUNCTUATION = /[:=,;.!?\-\u0964]+$/u;

function charBefore(s: string, i: number): string {
  if (i <= 0) return '';
  const low = s.charCodeAt(i - 1);
  if (low >= 0xdc00 && low <= 0xdfff && i >= 2) {
    const high = s.charCodeAt(i - 2);
    if (high >= 0xd800 && high <= 0xdbff) return s.slice(i - 2, i);
  }
  return s.slice(i - 1, i);
}

function charAt(s: string, i: number): string {
  const cp = s.codePointAt(i);
  return cp === undefined ? '' : String.fromCodePoint(cp);
}

function isWord(ch: string): boolean {
  return WORD_CHAR.test(ch);
}

/** A label may not start or end in the middle of a word ("name" is not found in "surname"). */
function onWordBoundary(folded: string, start: number, label: string): boolean {
  const end = start + label.length;
  if (isWord(charAt(label, 0)) && isWord(charBefore(folded, start))) return false;
  if (isWord(charBefore(label, label.length)) && isWord(charAt(folded, end))) return false;
  return true;
}

interface Hit {
  start: number;
  end: number;
  label: string;
}

/** Leftmost-longest, non-overlapping label occurrences in folded text. */
function findLabels(folded: string, labelsLongestFirst: readonly string[]): Hit[] {
  const hits: Hit[] = [];
  let i = 0;
  while (i < folded.length) {
    const label = labelsLongestFirst.find((l) => folded.startsWith(l, i) && onWordBoundary(folded, i, l));
    if (label === undefined) {
      i += 1;
    } else {
      hits.push({ start: i, end: i + label.length, label });
      i += label.length;
    }
  }
  return hits;
}

function wordKey(word: string): string {
  return word.toLowerCase().replace(WORD_PUNCTUATION, '');
}

/** Remove one connector phrase ("is", "my", "है", ...) from the start or end, if present. */
function stripConnector(value: string): string {
  const parts = value.split(/(\s+)/u); // words at even indexes, whitespace at odd ones
  const words = parts.filter((_, k) => k % 2 === 0);
  for (const phrase of connectorPhrases()) {
    const n = phrase.length;
    if (words.length < n) continue;
    if (phrase.every((p, k) => wordKey(words[k] ?? '') === p)) return parts.slice(2 * n).join('');
    if (phrase.every((p, k) => wordKey(words[words.length - n + k] ?? '') === p)) {
      return parts.slice(0, parts.length - 2 * n).join('');
    }
  }
  return value;
}

function cleanValue(raw: string): string {
  let value = raw;
  for (;;) {
    const before = value;
    value = stripConnector(value.replace(LEADING_SEPARATORS, '').replace(TRAILING_SEPARATORS, ''));
    if (value === before) return value;
  }
}

/**
 * Cut one free-text answer into field values. A label that belongs to exactly one field (an
 * exact label beats a synonym) gives a segment; a label shared equally by two or more fields,
 * and any text before the first label, go to `unmatched` (Req 4.3). Labels with no value are
 * dropped. Connectors from both languages are stripped, because answers often mix scripts.
 */
export function segment(text: string, index: readonly LabelEntry[]): SegmentResult {
  const nfc = text.normalize('NFC');
  const { folded, map } = foldForSearch(nfc);
  const labels = [...new Set(index.map((e) => e.label))].sort((a, b) => b.length - a.length);
  const hits = findLabels(folded, labels);
  const original = (from: number, to: number): string => nfc.slice(map[from] ?? 0, map[to] ?? nfc.length);

  const segments: Segment[] = [];
  const unmatched: string[] = [];

  const lead = cleanValue(original(0, hits[0]?.start ?? folded.length));
  if (lead !== '') unmatched.push(lead);

  hits.forEach((hit, k) => {
    const valueEnd = hits[k + 1]?.start ?? folded.length;
    const value = cleanValue(original(hit.end, valueEnd));
    if (value === '') return;
    const entries = index.filter((e) => e.label === hit.label);
    const best = entries.some((e) => e.exact) ? entries.filter((e) => e.exact) : entries;
    const fieldIds = [...new Set(best.map((e) => e.fieldId))];
    const [only] = fieldIds;
    if (fieldIds.length === 1 && only !== undefined) {
      segments.push({ fieldId: only, label: hit.label, value });
    } else {
      unmatched.push(cleanValue(original(hit.start, valueEnd)));
    }
  });

  return { segments, unmatched };
}
