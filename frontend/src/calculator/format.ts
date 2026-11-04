const MAX_SIGNIFICANT_DIGITS = 16;
const MIN_PLAIN_EXPONENT = -7;

/**
 * Turns an exact decimal string from the API into text that fits the display:
 * rounded to 16 significant digits, in scientific notation when very large or
 * very small. It works on the digits as text because results can hold more
 * precision than a JavaScript number, and only the display should lose it.
 */
export function formatNumber(value: string): string {
  const negative = value.startsWith('-');
  const [integer = '', fraction = ''] = value.replace(/^-/, '').split('.');
  const digits = integer + fraction;

  const firstDigit = digits.search(/[1-9]/);
  if (firstDigit === -1) return '0';

  // The power of ten of the first significant digit: 2 for 123, -2 for 0.012.
  const exponent = integer.length - firstDigit - 1;
  const rounded = roundDigits(digits.slice(firstDigit), exponent);
  const text = render(rounded.digits, rounded.exponent);
  return negative ? `-${text}` : text;
}

function roundDigits(digits: string, exponent: number) {
  if (digits.length <= MAX_SIGNIFICANT_DIGITS) {
    return { digits: digits.replace(/0+$/, ''), exponent };
  }
  const kept = BigInt(digits.slice(0, MAX_SIGNIFICANT_DIGITS));
  const roundUp = digits.charAt(MAX_SIGNIFICANT_DIGITS) >= '5';
  const result = (roundUp ? kept + 1n : kept).toString();
  return {
    digits: result.replace(/0+$/, ''),
    // Rounding 999… up to 1000… adds a digit.
    exponent: result.length > MAX_SIGNIFICANT_DIGITS ? exponent + 1 : exponent,
  };
}

function render(digits: string, exponent: number): string {
  if (exponent >= MAX_SIGNIFICANT_DIGITS || exponent < MIN_PLAIN_EXPONENT) {
    const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${mantissa}e${exponent >= 0 ? '+' : ''}${exponent}`;
  }
  if (exponent < 0) {
    return `0.${'0'.repeat(-exponent - 1)}${digits}`;
  }
  const integer = digits.slice(0, exponent + 1).padEnd(exponent + 1, '0');
  const fraction = digits.slice(exponent + 1);
  return fraction ? `${integer}.${fraction}` : integer;
}
