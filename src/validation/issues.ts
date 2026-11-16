// Issue codes shared by validation, mapping and the LLM adapter (validation spec, design.md).
// `llm-suggestion` and `llm-rejected` live here because the list is shared, but only the
// llm-adapter emits them.

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
