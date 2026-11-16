// Public API of the validation module. Other modules import only from here.

export type { IssueCode } from './issues';
export { ISSUE_CODES, SEVERITY, issue, messageFor } from './issues';
export { hasDevanagariDigits, toAsciiDigits, toDevanagariDigits } from './digits';
