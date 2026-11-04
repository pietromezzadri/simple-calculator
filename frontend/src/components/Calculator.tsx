import { useEffect } from 'react';
import { formatNumber } from '../calculator/format';
import type { Key } from '../calculator/reducer';
import { useCalculator } from '../calculator/useCalculator';
import { Display } from './Display';
import { Keypad, OPERATOR_SYMBOLS } from './Keypad';

const KEYBOARD: Record<string, Key> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  x: 'multiply',
  '/': 'divide',
  '^': 'power',
  '%': 'percent',
  r: 'sqrt',
  n: 'negate',
  '.': '.',
  ',': '.',
  '=': 'equals',
  Enter: 'equals',
  Backspace: 'backspace',
  Escape: 'clear',
  Delete: 'clear',
};

function keyFor(event: KeyboardEvent): Key | undefined {
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  if (/^[0-9]$/.test(event.key)) return event.key as Key;
  return KEYBOARD[event.key];
}

export function Calculator() {
  const { state, press } = useCalculator();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = keyFor(event);
      if (!key) return;
      // Stops Enter from also clicking the focused button, and "/" from opening
      // the browser's quick find.
      event.preventDefault();
      press(key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [press]);

  const expression =
    state.pending && state.accumulator !== null
      ? `${formatNumber(state.accumulator)} ${OPERATOR_SYMBOLS[state.pending]}`
      : '';
  const busy = state.request !== null;

  return (
    <section className="calculator" aria-label="Calculator" aria-busy={busy}>
      <Display
        expression={expression}
        value={state.overwrite ? formatNumber(state.entry) : state.entry}
        exactValue={state.entry}
        error={state.error}
      />
      <Keypad
        onPress={press}
        busy={busy}
        activeOperator={state.operandEntered ? null : state.pending}
      />
    </section>
  );
}
