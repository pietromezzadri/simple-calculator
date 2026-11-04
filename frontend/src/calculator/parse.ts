// Mirrors the backend's limits, so that a number which could never be used is
// refused when pasted rather than failing at a later step.
const MAX_LENGTH = 256;
const MAX_INTEGER_DIGITS = 100;

/**
 * Reads a number pasted from elsewhere, such as "$1,234.50", "1.234,5" or
 * "1e+16", and returns it as a plain decimal string, or null if it isn't one.
 * A lone group of three digits after a comma ("1,234") is read as thousands.
 */
export function parseNumber(text: string): string | null {
  const compact = text.trim().replace(/[\s']/g, '').replace('−', '-');
  const match = /^([+-]?)[$€£]?([\d.,]+)(?:[eE]([+-]?\d+))?$/.exec(compact);
  if (!match) return null;
  const [, sign, mantissa = '', exponent = '0'] = match;

  const parts = splitDecimal(mantissa);
  if (!parts || Math.abs(Number(exponent)) > MAX_LENGTH) return null;

  const { integer, fraction } = shiftPoint(parts.integer, parts.fraction, Number(exponent));
  if (integer.length > MAX_INTEGER_DIGITS || integer.length + fraction.length > MAX_LENGTH) return null;

  const value = fraction ? `${integer}.${fraction}` : integer;
  return sign === '-' && value !== '0' ? `-${value}` : value;
}

/** Works out which separators are thousands and which is the decimal point. */
function splitDecimal(text: string): { integer: string; fraction: string } | null {
  if (!/\d/.test(text)) return null;

  const decimalAt = decimalSeparatorIndex(text);
  if (decimalAt === null) return null;

  const integer = decimalAt === -1 ? text : text.slice(0, decimalAt);
  const fraction = decimalAt === -1 ? '' : text.slice(decimalAt + 1);
  if (/\D/.test(integer) && !/^\d{1,3}([.,]\d{3})+$/.test(integer)) return null;

  return { integer: integer.replace(/\D/g, ''), fraction };
}

/** The decimal separator's position, -1 if there is none, null if it's ambiguous. */
function decimalSeparatorIndex(text: string): number | null {
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) return Math.max(lastDot, lastComma);

  const separator = lastDot !== -1 ? '.' : ',';
  const count = text.split(separator).length - 1;
  if (count === 0) return -1;
  if (/^\d{1,3}([.,]\d{3})+$/.test(text) && (count > 1 || separator === ',')) return -1;
  return count === 1 ? text.indexOf(separator) : null;
}

/** Applies an exponent by moving the decimal point, and tidies the result. */
function shiftPoint(integer: string, fraction: string, exponent: number) {
  const digits = integer + fraction;
  const point = integer.length + exponent;
  const shifted =
    point <= 0
      ? { integer: '', fraction: '0'.repeat(-point) + digits }
      : { integer: digits.slice(0, point).padEnd(point, '0'), fraction: digits.slice(point) };
  return {
    integer: shifted.integer.replace(/^0+/, '') || '0',
    fraction: shifted.fraction.replace(/0+$/, ''),
  };
}
