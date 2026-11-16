// Label synonym lookup. The lists themselves live in synonyms.en.json and synonyms.hi.json
// (field-mapping Req 4.5); this file only indexes them.

import en from './synonyms.en.json';
import hi from './synonyms.hi.json';
import { normaliseLabel } from './normalise-label';

export interface SynonymFile {
  note: string;
  labels: Record<string, string[]>;
}

const FILES: readonly SynonymFile[] = [en, hi];

const KEY_BY_LABEL = new Map<string, string>();
const LABELS_BY_KEY = new Map<string, string[]>();

for (const file of FILES) {
  for (const [key, variants] of Object.entries(file.labels)) {
    const list = LABELS_BY_KEY.get(key) ?? [];
    for (const variant of variants) {
      const label = normaliseLabel(variant);
      if (label === '' || KEY_BY_LABEL.has(label)) continue;
      KEY_BY_LABEL.set(label, key);
      list.push(label);
    }
    LABELS_BY_KEY.set(key, list);
  }
}

// A printed label may carry a format hint, for example "Date of birth (DD/MM/YYYY)".
const TRAILING_HINT = /\s*\([^()]*\)$/u;

/** The canonical key ("dob", "full-name", ...) for a label in English or Hindi, or null. */
export function canonicalKeyFor(label: string): string | null {
  const normalised = normaliseLabel(label);
  const direct = KEY_BY_LABEL.get(normalised);
  if (direct !== undefined) return direct;
  const withoutHint = normaliseLabel(normalised.replace(TRAILING_HINT, ''));
  return withoutHint === normalised ? null : (KEY_BY_LABEL.get(withoutHint) ?? null);
}

/** Every normalised English and Hindi variant of a label's canonical key, or [] if unknown. */
export function synonymsFor(label: string): string[] {
  const key = canonicalKeyFor(label);
  return key === null ? [] : [...(LABELS_BY_KEY.get(key) ?? [])];
}

/** Every canonical key with its normalised variants, for tests and tooling. */
export function allSynonyms(): ReadonlyMap<string, readonly string[]> {
  return LABELS_BY_KEY;
}
