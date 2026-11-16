// Public API of the validation module. Other modules import only from here.

export type { IssueCode } from './issues';
export { hasDevanagariDigits, toAsciiDigits, toDevanagariDigits } from './digits';
