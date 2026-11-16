import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hasDevanagariDigits, toAsciiDigits, toDevanagariDigits } from './digits';

describe('digit conversion (Req 1.2, 3.2)', () => {
  it('maps every Devanagari digit to its ASCII digit', () => {
    expect(toAsciiDigits('०१२३४५६७८९')).toBe('0123456789');
    expect(toDevanagariDigits('0123456789')).toBe('०१२३४५६७८९');
  });

  it('leaves other characters alone, including Devanagari letters', () => {
    expect(toAsciiDigits('५ मार्च २००४')).toBe('5 मार्च 2004');
    expect(toAsciiDigits('05/03/2004')).toBe('05/03/2004');
    expect(toDevanagariDigits('05/03/2004')).toBe('०५/०३/२००४');
    expect(toAsciiDigits('')).toBe('');
  });

  it('detects Devanagari digits', () => {
    expect(hasDevanagariDigits('२००४')).toBe(true);
    expect(hasDevanagariDigits('2004 मार्च')).toBe(false);
  });

  it('round-trips any digit string through Devanagari', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9]{0,12}$/), (digits) => {
        const deva = toDevanagariDigits(digits);
        expect(hasDevanagariDigits(deva) || digits === '').toBe(true);
        expect(toAsciiDigits(deva)).toBe(digits);
      }),
    );
  });

  it('never changes the length of a string', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 40 }), (s) => {
        expect(toAsciiDigits(s)).toHaveLength(s.length);
        expect(toDevanagariDigits(s)).toHaveLength(s.length);
      }),
    );
  });
});
