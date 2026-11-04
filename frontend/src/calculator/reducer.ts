import type { ApiCall, BinaryOperator } from '../api/client';
import { parseNumber } from './parse';

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export type Key =
  | Digit
  | BinaryOperator
  | '.'
  | 'equals'
  | 'percent'
  | 'sqrt'
  | 'negate'
  | 'backspace'
  | 'clear';

/** What to do with the answer once a request comes back. */
type Continuation =
  | { kind: 'equals' }
  | { kind: 'operator'; next: BinaryOperator }
  | { kind: 'replaceEntry' };

export interface CalculatorState {
  /** The number being typed, or the exact value of the last result. */
  entry: string;
  /** The entry is a finished value, so the next digit starts a new number. */
  overwrite: boolean;
  /** The entry is the right-hand operand of the pending operator. */
  operandEntered: boolean;
  /** The left-hand operand of the pending operator. */
  accumulator: string | null;
  pending: BinaryOperator | null;
  /** The call in flight. Setting this is what makes the hook send it. */
  request: { call: ApiCall; then: Continuation } | null;
  error: string | null;
}

export type Action =
  | { type: 'press'; key: Key }
  | { type: 'paste'; text: string }
  | { type: 'showError'; message: string }
  | { type: 'resolved'; result: string }
  | { type: 'rejected'; message: string };

export const MAX_ENTRY_DIGITS = 16;

export const initialState: CalculatorState = {
  entry: '0',
  overwrite: false,
  operandEntered: false,
  accumulator: null,
  pending: null,
  request: null,
  error: null,
};

export function reducer(state: CalculatorState, action: Action): CalculatorState {
  switch (action.type) {
    case 'press':
      return press(state, action.key);
    case 'paste':
      return paste(state, action.text);
    case 'showError':
      return { ...state, error: action.message };
    case 'resolved':
      return state.request ? applyResult(state, state.request.then, action.result) : state;
    case 'rejected':
      // The calculation is kept, so the user can correct the entry or retry.
      return state.request ? { ...state, request: null, error: action.message, overwrite: true } : state;
  }
}

function press(previous: CalculatorState, key: Key): CalculatorState {
  if (key === 'clear') return initialState;
  // Only one request at a time, so that answers can't arrive out of order.
  if (previous.request) return previous;

  const state: CalculatorState = previous.error ? { ...previous, error: null } : previous;
  switch (key) {
    case '.':
      return typePoint(state);
    case 'backspace':
      return backspace(state);
    case 'negate':
      return negate(state);
    case 'equals':
      return equals(state);
    case 'percent':
      return percent(state);
    case 'sqrt':
      return send(state, { op: 'sqrt', a: operand(state) }, { kind: 'replaceEntry' });
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
    case 'power':
      return chooseOperator(state, key);
    default:
      return typeDigit(state, key);
  }
}

/**
 * A pasted number replaces the entry whole, like a result: it can be longer than
 * the digit limit for typing, and the next digit starts a new number.
 */
function paste(state: CalculatorState, text: string): CalculatorState {
  if (state.request) return state;
  const value = parseNumber(text);
  if (value === null) {
    return { ...state, error: "That isn't a number the calculator can use.", overwrite: true };
  }
  return { ...state, entry: value, overwrite: true, operandEntered: true, error: null };
}

function typeDigit(state: CalculatorState, digit: Digit): CalculatorState {
  if (state.overwrite || state.entry === '0') {
    return { ...state, entry: digit, overwrite: false, operandEntered: true };
  }
  if (state.entry.replace(/\D/g, '').length >= MAX_ENTRY_DIGITS) return state;
  return { ...state, entry: state.entry + digit, operandEntered: true };
}

function typePoint(state: CalculatorState): CalculatorState {
  if (state.overwrite) {
    return { ...state, entry: '0.', overwrite: false, operandEntered: true };
  }
  if (state.entry.includes('.')) return state;
  return { ...state, entry: `${state.entry}.`, operandEntered: true };
}

function backspace(state: CalculatorState): CalculatorState {
  if (state.overwrite) return state;
  const entry = state.entry.slice(0, -1);
  return { ...state, entry: ['', '-', '-0'].includes(entry) ? '0' : entry };
}

/** Changing the sign is editing text, not arithmetic, so it needs no request. */
function negate(state: CalculatorState): CalculatorState {
  if (state.entry === '0') return state;
  const entry = state.entry.startsWith('-') ? state.entry.slice(1) : `-${state.entry}`;
  return { ...state, entry, operandEntered: true };
}

function chooseOperator(state: CalculatorState, operator: BinaryOperator): CalculatorState {
  if (state.pending && state.accumulator !== null && state.operandEntered) {
    const call = { op: state.pending, a: state.accumulator, b: operand(state) };
    return send(state, call, { kind: 'operator', next: operator });
  }
  return {
    ...state,
    accumulator: operand(state),
    pending: operator,
    operandEntered: false,
    overwrite: true,
  };
}

function equals(state: CalculatorState): CalculatorState {
  if (!state.pending || state.accumulator === null) return { ...state, overwrite: true };
  const call = { op: state.pending, a: state.accumulator, b: operand(state) };
  return send(state, call, { kind: 'equals' });
}

/**
 * Percent means what it does on a phone calculator: adding or subtracting a
 * percentage takes it of the running total (200 + 10% is 200 + 20), and
 * otherwise it is a plain fraction (200 × 10% is 200 × 0.1).
 */
function percent(state: CalculatorState): CalculatorState {
  const ofTotal = state.pending === 'add' || state.pending === 'subtract';
  const b = ofTotal && state.accumulator !== null ? state.accumulator : '1';
  return send(state, { op: 'percentage', a: operand(state), b }, { kind: 'replaceEntry' });
}

function send(state: CalculatorState, call: ApiCall, then: Continuation): CalculatorState {
  return { ...state, request: { call, then } };
}

function applyResult(state: CalculatorState, then: Continuation, result: string): CalculatorState {
  const settled = { ...state, entry: result, overwrite: true, request: null };
  switch (then.kind) {
    case 'equals':
      return { ...settled, accumulator: null, pending: null, operandEntered: false };
    case 'operator':
      return { ...settled, accumulator: result, pending: then.next, operandEntered: false };
    case 'replaceEntry':
      return { ...settled, operandEntered: true };
  }
}

/** The entry as a number for the API: a half-typed "5." is sent as "5". */
function operand(state: CalculatorState): string {
  return state.entry.replace(/\.$/, '');
}
