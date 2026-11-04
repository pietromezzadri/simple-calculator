import { describe, expect, it } from 'vitest';
import { initialState, MAX_ENTRY_DIGITS, reducer, type CalculatorState, type Key } from './reducer';

function pressAll(keys: Key[], state: CalculatorState = initialState): CalculatorState {
  return keys.reduce((current, key) => reducer(current, { type: 'press', key }), state);
}

function resolve(state: CalculatorState, result: string): CalculatorState {
  return reducer(state, { type: 'resolved', result });
}

function reject(state: CalculatorState, message: string): CalculatorState {
  return reducer(state, { type: 'rejected', message });
}

describe('typing a number', () => {
  it('replaces the leading zero', () => {
    expect(pressAll(['5']).entry).toBe('5');
    expect(pressAll(['0', '0', '7']).entry).toBe('7');
  });

  it('appends digits', () => {
    expect(pressAll(['1', '2', '3']).entry).toBe('123');
  });

  it('allows one decimal point', () => {
    expect(pressAll(['1', '.', '5', '.', '2']).entry).toBe('1.52');
  });

  it('puts a zero before a leading point', () => {
    expect(pressAll(['.', '5']).entry).toBe('0.5');
  });

  it('keeps zeros after the point', () => {
    expect(pressAll(['0', '.', '0', '0', '1']).entry).toBe('0.001');
  });

  it('stops at the digit limit, not counting the point or sign', () => {
    const digits = Array<Key>(MAX_ENTRY_DIGITS).fill('1');
    const full = pressAll([...digits, 'negate']);
    expect(pressAll(['2'], full).entry).toBe(full.entry);

    const withPoint = pressAll(['1', '.', ...Array<Key>(MAX_ENTRY_DIGITS - 1).fill('2')]);
    expect(pressAll(['3'], withPoint).entry).toBe(withPoint.entry);
  });
});

describe('editing', () => {
  it('backspace removes the last character', () => {
    expect(pressAll(['1', '2', 'backspace']).entry).toBe('1');
    expect(pressAll(['1', '.', 'backspace']).entry).toBe('1');
  });

  it('backspace on the last digit leaves zero', () => {
    expect(pressAll(['5', 'backspace']).entry).toBe('0');
    expect(pressAll(['5', 'negate', 'backspace']).entry).toBe('0');
    expect(pressAll(['0', '.', 'negate', 'backspace']).entry).toBe('0');
  });

  it('backspace does not edit a result', () => {
    const result = resolve(pressAll(['2', 'add', '3', 'equals']), '5');
    expect(pressAll(['backspace'], result).entry).toBe('5');
  });

  it('negate toggles the sign', () => {
    expect(pressAll(['5', 'negate']).entry).toBe('-5');
    expect(pressAll(['5', 'negate', 'negate']).entry).toBe('5');
  });

  it('negate leaves zero alone but works on a typed fraction', () => {
    expect(pressAll(['negate']).entry).toBe('0');
    expect(pressAll(['0', '.', 'negate', '5']).entry).toBe('-0.5');
  });

  it('clear resets everything', () => {
    expect(pressAll(['2', 'add', '3', 'clear'])).toEqual(initialState);
  });
});

describe('binary operations', () => {
  it('an operator waits for the second number and sends nothing', () => {
    const state = pressAll(['2', 'add']);
    expect(state).toMatchObject({ pending: 'add', accumulator: '2', request: null });
  });

  it('equals sends the calculation', () => {
    const state = pressAll(['2', 'add', '3', 'equals']);
    expect(state.request?.call).toEqual({ op: 'add', a: '2', b: '3' });
  });

  it('shows the result and finishes the calculation', () => {
    const state = resolve(pressAll(['2', 'add', '3', 'equals']), '5');
    expect(state).toMatchObject({ entry: '5', pending: null, accumulator: null, request: null });
  });

  it('a digit after a result starts a new number', () => {
    const state = resolve(pressAll(['2', 'add', '3', 'equals']), '5');
    expect(pressAll(['7'], state).entry).toBe('7');
    expect(pressAll(['.'], state).entry).toBe('0.');
  });

  it('an operator after a result continues from it', () => {
    const state = resolve(pressAll(['2', 'add', '3', 'equals']), '5');
    expect(pressAll(['multiply', '4', 'equals'], state).request?.call).toEqual({
      op: 'multiply',
      a: '5',
      b: '4',
    });
  });

  it('a second operator evaluates the first, left to right', () => {
    const chained = pressAll(['2', 'add', '3', 'multiply']);
    expect(chained.request?.call).toEqual({ op: 'add', a: '2', b: '3' });

    const after = resolve(chained, '5');
    expect(after).toMatchObject({ entry: '5', accumulator: '5', pending: 'multiply' });
    expect(pressAll(['4', 'equals'], after).request?.call).toEqual({ op: 'multiply', a: '5', b: '4' });
  });

  it('pressing another operator straight away just changes it', () => {
    const state = pressAll(['2', 'add', 'multiply']);
    expect(state).toMatchObject({ pending: 'multiply', accumulator: '2', request: null });
  });

  it('equals with no second number uses the first twice', () => {
    expect(pressAll(['5', 'add', 'equals']).request?.call).toEqual({ op: 'add', a: '5', b: '5' });
  });

  it('equals with nothing pending does nothing but finish the entry', () => {
    const state = pressAll(['5', 'equals']);
    expect(state.request).toBeNull();
    expect(pressAll(['7'], state).entry).toBe('7');
  });

  it('chains on the exact result, not the rounded display', () => {
    const third = '0.3333333333333333333333333333333333';
    const state = resolve(pressAll(['1', 'divide', '3', 'multiply']), third);
    expect(pressAll(['3', 'equals'], state).request?.call).toMatchObject({ a: third });
  });

  it('drops a trailing point from operands', () => {
    expect(pressAll(['5', '.', 'add', '2', '.', 'equals']).request?.call).toEqual({
      op: 'add',
      a: '5',
      b: '2',
    });
  });

  it('negating while waiting makes a second operand', () => {
    expect(pressAll(['5', 'add', 'negate', 'equals']).request?.call).toEqual({
      op: 'add',
      a: '5',
      b: '-5',
    });
  });
});

describe('one-number operations', () => {
  it('square root replaces the entry', () => {
    const state = pressAll(['9', 'sqrt']);
    expect(state.request?.call).toEqual({ op: 'sqrt', a: '9' });
    expect(resolve(state, '3').entry).toBe('3');
  });

  it('square root result becomes the second operand', () => {
    const state = resolve(pressAll(['1', 'add', '9', 'sqrt']), '3');
    expect(pressAll(['equals'], state).request?.call).toEqual({ op: 'add', a: '1', b: '3' });
  });

  it('percent with nothing pending is a fraction', () => {
    expect(pressAll(['5', '0', 'percent']).request?.call).toEqual({ op: 'percentage', a: '50', b: '1' });
  });

  it.each(['add', 'subtract'] as const)('percent after %s takes it of the total', (operator) => {
    const state = pressAll(['2', '0', '0', operator, '1', '0', 'percent']);
    expect(state.request?.call).toEqual({ op: 'percentage', a: '10', b: '200' });

    const after = resolve(state, '20');
    expect(after.entry).toBe('20');
    expect(pressAll(['equals'], after).request?.call).toEqual({ op: operator, a: '200', b: '20' });
  });

  it.each(['multiply', 'divide', 'power'] as const)('percent after %s is a fraction', (operator) => {
    const state = pressAll(['2', '0', '0', operator, '1', '0', 'percent']);
    expect(state.request?.call).toEqual({ op: 'percentage', a: '10', b: '1' });
  });
});

describe('pasting', () => {
  function paste(state: CalculatorState, text: string): CalculatorState {
    return reducer(state, { type: 'paste', text });
  }

  it('replaces the entry with the number', () => {
    expect(paste(pressAll(['1', '2']), '$1,234.50').entry).toBe('1234.5');
  });

  it('keeps more digits than can be typed', () => {
    const long = '1234567890.123456789';
    expect(paste(initialState, long).entry).toBe(long);
  });

  it('becomes the second operand of a pending operation', () => {
    const state = paste(pressAll(['2', 'add']), '3');
    expect(pressAll(['equals'], state).request?.call).toEqual({ op: 'add', a: '2', b: '3' });
  });

  it('a digit afterwards starts a new number', () => {
    expect(pressAll(['7'], paste(initialState, '42')).entry).toBe('7');
  });

  it('shows an error for anything else, and keeps the calculation', () => {
    const state = paste(pressAll(['2', 'add', '3']), 'hello');
    expect(state.error).toBe("That isn't a number the calculator can use.");
    expect(state).toMatchObject({ entry: '3', accumulator: '2', pending: 'add' });
    expect(pressAll(['equals'], state).request?.call).toEqual({ op: 'add', a: '2', b: '3' });
  });

  it('clears an earlier error', () => {
    expect(paste(paste(initialState, 'hello'), '5').error).toBeNull();
  });

  it('is ignored while a request is in flight', () => {
    const inFlight = pressAll(['2', 'add', '3', 'equals']);
    expect(paste(inFlight, '5')).toBe(inFlight);
  });
});

describe('while a request is in flight', () => {
  const inFlight = pressAll(['2', 'add', '3', 'equals']);

  it.each<Key>(['1', '.', 'add', 'equals', 'percent', 'sqrt', 'negate', 'backspace'])(
    'ignores %s',
    (key) => {
      expect(pressAll([key], inFlight)).toBe(inFlight);
    },
  );

  it('clear still works, cancelling the request', () => {
    expect(pressAll(['clear'], inFlight)).toEqual(initialState);
  });

  it('ignores an answer that arrives after clear', () => {
    const cleared = pressAll(['clear'], inFlight);
    expect(resolve(cleared, '5')).toBe(cleared);
    expect(reject(cleared, 'late')).toBe(cleared);
  });
});

describe('errors', () => {
  const failed = reject(pressAll(['5', 'divide', '0', 'equals']), 'Cannot divide by zero.');

  it('shows the message and ends the request', () => {
    expect(failed).toMatchObject({ error: 'Cannot divide by zero.', request: null });
  });

  it('any key clears the message', () => {
    expect(pressAll(['2'], failed).error).toBeNull();
    expect(pressAll(['backspace'], failed).error).toBeNull();
    expect(pressAll(['clear'], failed).error).toBeNull();
  });

  it('keeps the calculation, so a corrected number can be used', () => {
    expect(pressAll(['2', 'equals'], failed).request?.call).toEqual({ op: 'divide', a: '5', b: '2' });
  });

  it('can retry the same calculation', () => {
    expect(pressAll(['equals'], failed).request?.call).toEqual({ op: 'divide', a: '5', b: '0' });
  });
});
