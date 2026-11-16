// Shared field model (field-mapping spec, design.md "Types"). Every module talks about a form
// through these types. The form model never holds answers (Req 1.4): answers live in Answer
// objects and in the MappingResult.

import type { IssueCode } from '../validation/issues';

export type { IssueCode };

export type FieldType =
  | 'text'
  | 'date'
  | 'number'
  | 'choice'
  | 'checkbox'
  | 'signature'
  | 'photo';

/** Fractions of page width and height, origin top-left. 0 <= x, y, w, h and x + w <= 1, y + h <= 1. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FormField {
  /** Unique within the form, [a-z0-9-]+. */
  id: string;
  /** Label as printed (English or Hindi). */
  label: string;
  type: FieldType;
  required: boolean;
  bbox: BBox;
  /** 0-based page index. */
  page: number;
  /** Required and non-empty when type === "choice". */
  choices?: string[];
  /** Lets validation apply date of birth plausibility checks. */
  dateRole?: 'dob' | 'other';
}

export interface PageInfo {
  index: number;
  widthPt: number;
  heightPt: number;
}

export interface FormModel {
  /** For example "sample-lantern-hill-admission". */
  id: string;
  title: string;
  source: 'sample' | 'ocr' | 'manual';
  pages: PageInfo[];
  fields: FormField[];
}

export type AnswerSource = 'typed' | 'voice' | 'stitch-code' | 'llm';

export interface Answer {
  /** Raw text as typed or recognised. */
  text: string;
  source: AnswerSource;
  lang: 'en' | 'hi';
  /** Set when the user answered a prompt for one field. */
  promptedFieldId?: string;
  /** Order of entry; later wins (Req 3.4). */
  seq: number;
}

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  fieldId: string;
  /** Defined in validation/issues.ts. */
  code: IssueCode;
  severity: Severity;
  /** Never contains the answer value. */
  params?: Record<string, string>;
}

export type FieldStatus = 'filled' | 'flagged' | 'empty';

export interface FieldResult {
  fieldId: string;
  status: FieldStatus;
  /** Normalised value, only when status === "filled". */
  value?: string;
  /** What the user entered, kept when flagged so they can edit it. */
  raw?: string;
  provenance?: AnswerSource;
  issues: Issue[];
}

export interface MappingResult {
  formId: string;
  /** One entry per form field, always. */
  fields: Record<string, FieldResult>;
  /** Free-text segments that matched no single field. */
  unmatched: string[];
}
