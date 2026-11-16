// Issue codes shared by validation, mapping and the LLM adapter (validation spec, design.md).
// `llm-suggestion` and `llm-rejected` live here because the list is shared, but only the
// llm-adapter emits them. Issues never carry the answer value (Req 5.1).

import type { Issue, Severity } from '../form-model/types';
import messagesEn from './messages.en.json';
import messagesHi from './messages.hi.json';

export type IssueCode =
  | 'required-missing'
  | 'signature-missing'
  | 'photo-paste-after-print'
  | 'date-unparsed'
  | 'date-impossible'
  | 'date-two-digit-year'
  | 'dob-in-future'
  | 'dob-implausible'
  | 'number-invalid'
  | 'choice-unknown'
  | 'checkbox-unknown'
  | 'free-text-ignored'
  | 'llm-suggestion'
  | 'llm-rejected';

/** Severity of each issue code. A Record, so the compiler rejects a missing code. */
export const SEVERITY: Readonly<Record<IssueCode, Severity>> = {
  'required-missing': 'error',
  'signature-missing': 'error',
  'photo-paste-after-print': 'info',
  'date-unparsed': 'error',
  'date-impossible': 'error',
  'date-two-digit-year': 'warning',
  'dob-in-future': 'error',
  'dob-implausible': 'warning',
  'number-invalid': 'error',
  'choice-unknown': 'error',
  'checkbox-unknown': 'error',
  'free-text-ignored': 'warning',
  'llm-suggestion': 'info',
  'llm-rejected': 'info',
};

export const ISSUE_CODES = Object.keys(SEVERITY) as IssueCode[];

/** Build an issue with the severity from the table. `params` must never hold the answer value. */
export function issue(fieldId: string, code: IssueCode, params?: Record<string, string>): Issue {
  const out: Issue = { fieldId, code, severity: SEVERITY[code] };
  if (params !== undefined) out.params = { ...params };
  return out;
}

const MESSAGES: Readonly<Record<'en' | 'hi', Readonly<Record<string, string>>>> = {
  en: messagesEn,
  hi: messagesHi,
};

/**
 * Plain-language message for an issue in English or Hindi (Req 5.2). `{name}` placeholders are
 * filled from `params`. The UI must insert the result as text, never as HTML.
 */
export function messageFor(code: IssueCode, lang: 'en' | 'hi', params: Record<string, string> = {}): string {
  const template = MESSAGES[lang][code] ?? MESSAGES.en[code] ?? code;
  return template.replace(/\{([a-z]+)\}/gu, (_, name: string) => params[name] ?? '');
}
