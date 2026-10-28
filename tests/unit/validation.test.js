import { describe, it, expect } from 'vitest';
import { checkBody, checkId, MAX_INT, str } from '../../src/utils/validation';

describe('checkBody', () => {
  it('return body, if all fields are allowed', () => {
    const body = { name: 'Project', description: 'Test project' };

    expect(checkBody(body, ['name', 'description'])).toBe(body);
  });

  it('throw error, if body is not an object', () => {
    expect(() => checkBody(null, ['name'])).toThrow('Request body must be a JSON object');
  });

  it('throw error, if there is invalid field', () => {
    const body = { name: 'Project', unknown: 'value' };

    expect(() => checkBody(body, ['name'])).toThrow('Unknown field: unknown');
  });
});

describe('str', () => {
  it('return trimmed string', () => {
    expect(str(' blablabla ', 'name', { min: 2, max: 100 })).toBe('blablabla');
  });

  it('accepts a string of the minimum allowable length', () => {
    expect(str('ab', 'name', { min: 2 })).toBe('ab');
  });

  it('accepts a string of the maximum allowable length', () => {
    expect(str('my name', 'name', { max: 7 })).toBe('my name');
  });

  it('throw error if value is not a string', () => {
    expect(() => str(1, 'name', { max: 7 })).toThrow(
      expect.objectContaining({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'name: must be a string',
      }),
    );
  });
});

describe('checkId', () => {
  it('return correct id', () => {
    expect(checkId(1, 'age'), 1);
  });

  it('accept max allowed id', () => {
    expect(checkId(MAX_INT));
  });

  it.each([
    [0, 'zero'],
    [-1, 'negative value'],
    [1.5, 'fractional number'],
    [2147483648, '> MAX_INT'],
    ['123', 'string'],
    [NaN, 'NaN'],
  ])('reject invalid ID: %s (%s)', (value) => {
    expect(() => checkId(value, 'userId')).toThrow('userId: must be a positive integer');
  });
});
