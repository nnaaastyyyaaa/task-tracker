import { describe, it, expect } from 'vitest';
import { parseId } from '../../src/utils/parseId.js';

describe('parseId works correctly with valid and invalid parameters', () => {
  it('return number for such ID', () => {
    expect(parseId('1')).toBe(1);
    expect(parseId('123')).toBe(123);
    expect(parseId('2147483647')).toBe(2147483647);
  });

  it.each([
    ['0', 'zero'],
    ['-1', 'negative number'],
    ['1.5', 'fractional number'],
    ['abc', 'not number'],
    ['2147483648', 'number bigger than max allowed ID'],
  ])('reject %s (%s)', (raw) => {
    expect(() => parseId(raw)).toThrow(
      expect.objectContaining({
        status: 400,
        code: 'VALIDATION_ERROR',
      }),
    );
  });
});
