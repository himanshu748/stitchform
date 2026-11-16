// Public API of the validation module. Other modules import only from here.

export type { IssueCode } from './issues';
export { ISSUE_CODES, SEVERITY, issue, messageFor } from './issues';
export { hasDevanagariDigits, toAsciiDigits, toDevanagariDigits } from './digits';
export type { CalendarDate, DateFormat, ParseDateOptions, ParseDateResult } from './dates';
export { DATE_FORMATS, ageOn, canonicalDate, checkDateOfBirth, compareDates, formatDate, isValidCalendarDate, parseDate, resolveTwoDigitYear } from './dates';
export { HINDI_NUMBER_WORDS, foldDevanagari, parseHindiNumber } from './hindi-numbers';
export { MONTH_NAMES, monthFromName } from './months';
export type { ValidationContext, ValidationOutcome } from './validators';
export { SIGNATURE_PRESENT, normaliseText, validateField } from './validators';
