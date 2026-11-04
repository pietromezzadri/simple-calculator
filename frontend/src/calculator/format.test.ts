import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';

describe('formatNumber', () => {
  it.each([
    ['0', '0'],
    ['-0', '0'],
    ['0.000', '0'],
    ['5', '5'],
    ['5.', '5'],
    ['-5', '-5'],
    ['1000', '1000'],
    ['0.5', '0.5'],
    ['2.50', '2.5'],
    ['-0.125', '-0.125'],
    ['1234.5678', '1234.5678'],
  ])('shows %s as %s', (input, expected) => {
    expect(formatNumber(input)).toBe(expected);
  });

  it.each([
    ['0.3333333333333333333333333333333333', '0.3333333333333333'],
    ['0.6666666666666666666666666666666667', '0.6666666666666667'],
    ['-0.6666666666666666666666666666666667', '-0.6666666666666667'],
    ['1.4142135623730950488016887242096981', '1.414213562373095'],
  ])('rounds %s to fit', (input, expected) => {
    expect(formatNumber(input)).toBe(expected);
  });

  it('carries a rounding through every digit', () => {
    expect(formatNumber('0.9999999999999999999999999999999999')).toBe('1');
    expect(formatNumber('99.99999999999999999')).toBe('100');
  });

  it('keeps the longest integers plain', () => {
    expect(formatNumber('1234567890123456')).toBe('1234567890123456');
    expect(formatNumber('1000000000000000')).toBe('1000000000000000');
  });

  it.each([
    ['12345678901234567', '1.234567890123457e+16'],
    ['10000000000000000', '1e+16'],
    ['-10000000000000000', '-1e+16'],
    ['9999999999999999.9', '1e+16'],
    ['0.00000001', '1e-8'],
    ['0.000000015', '1.5e-8'],
  ])('uses scientific notation for %s', (input, expected) => {
    expect(formatNumber(input)).toBe(expected);
  });

  it('keeps small numbers plain down to the limit', () => {
    expect(formatNumber('0.0000001')).toBe('0.0000001');
  });
});
