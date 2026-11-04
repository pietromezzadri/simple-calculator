import { describe, expect, it } from 'vitest';
import { parseNumber } from './parse';

describe('parseNumber', () => {
  it.each([
    ['5', '5'],
    ['-5', '-5'],
    ['+5', '5'],
    ['−5', '-5'],
    ['0', '0'],
    ['-0', '0'],
    ['007', '7'],
    ['2.50', '2.5'],
    ['5.', '5'],
    ['.5', '0.5'],
    ['1,5', '1.5'],
    ['0.3333333333333333333333333333333333', '0.3333333333333333333333333333333333'],
  ])('reads %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each([
    ['  42\n', '42'],
    ['1 234', '1234'],
    ['1 234,5', '1234.5'],
    ["1'234.5", '1234.5'],
  ])('ignores spacing in %j', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each([
    ['1,234', '1234'],
    ['1,234,567', '1234567'],
    ['1.234.567', '1234567'],
    ['1,234.5', '1234.5'],
    ['1.234,5', '1234.5'],
    ['1.234', '1.234'],
    ['1,23', '1.23'],
    ['1,2345', '1.2345'],
  ])('tells thousands from decimals in %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each([
    ['$1,234.50', '1234.5'],
    ['-$5', '-5'],
    ['€5', '5'],
    ['£5', '5'],
  ])('drops the currency sign in %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each([
    ['1e+16', '10000000000000000'],
    ['1.5e3', '1500'],
    ['1.5E3', '1500'],
    ['1.2345e2', '123.45'],
    ['1.5e-8', '0.000000015'],
    ['123e-1', '12.3'],
    ['123e-3', '0.123'],
    ['-2e2', '-200'],
    ['0e5', '0'],
  ])('expands the exponent in %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['12a'],
    ['2 + 2'],
    ['1-2'],
    ['--5'],
    ['.'],
    [','],
    ['1.2.3'],
    ['1,2,3'],
    ['1,23,456'],
    ['1.5,2.5'],
    ['1e'],
    ['e5'],
    ['1e5.5'],
    ['NaN'],
    ['Infinity'],
    ['0x10'],
    ['50%'],
  ])('rejects %j', (input) => {
    expect(parseNumber(input)).toBeNull();
  });

  it('accepts the largest values the backend accepts, and no more', () => {
    expect(parseNumber('9'.repeat(100))).toBe('9'.repeat(100));
    expect(parseNumber('1e99')).toBe(`1${'0'.repeat(99)}`);
    expect(parseNumber('1'.repeat(101))).toBeNull();
    expect(parseNumber('1e100')).toBeNull();
    expect(parseNumber(`0.${'1'.repeat(256)}`)).toBeNull();
  });

  it('refuses extreme exponents without expanding them', () => {
    expect(parseNumber('1e1000000000')).toBeNull();
    expect(parseNumber('1e-1000000000')).toBeNull();
    expect(parseNumber('1e-257')).toBeNull();
  });
});
