import type { BBox, FormField, FormModel } from './types';

const ID_PATTERN = /^[a-z0-9-]+$/;

function isFraction(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}

function bboxProblem(b: BBox): string | null {
  if (!isFraction(b.x) || !isFraction(b.y) || !isFraction(b.w) || !isFraction(b.h)) {
    return 'its box must use numbers from 0 to 1';
  }
  if (b.x + b.w > 1 || b.y + b.h > 1) return 'its box goes past the edge of the page';
  return null;
}

function fieldProblems(f: FormField, pageIndexes: ReadonlySet<number>): string[] {
  const problems: string[] = [];
  const name = `Field "${f.id}"`;
  if (!ID_PATTERN.test(f.id)) {
    problems.push(`${name}: the ID may only use lower-case letters, digits and "-".`);
  }
  const box = bboxProblem(f.bbox);
  if (box !== null) problems.push(`${name}: ${box}.`);
  if (!Number.isInteger(f.page) || !pageIndexes.has(f.page)) {
    problems.push(`${name}: page ${String(f.page)} is not a page of this form.`);
  }
  if (f.type === 'choice') {
    const choices = f.choices ?? [];
    if (choices.length === 0) problems.push(`${name}: a choice field needs at least one option.`);
    else if (choices.some((c) => c.trim() === '')) problems.push(`${name}: an option is blank.`);
  }
  return problems;
}

/**
 * Check a form model before it is used (field-mapping Req 1.3). Rejects duplicate field IDs,
 * boxes outside 0 to 1, a page that is not part of the form, and choice fields without options.
 * Errors are plain-language sentences that name field IDs only.
 */
export function validateFormModel(m: FormModel): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const pageIndexes = new Set(m.pages.map((p) => p.index));
  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const f of m.fields) {
    if (seen.has(f.id) && !reported.has(f.id)) {
      errors.push(`Two or more fields use the ID "${f.id}". Each field needs its own ID.`);
      reported.add(f.id);
    }
    seen.add(f.id);
    errors.push(...fieldProblems(f, pageIndexes));
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
