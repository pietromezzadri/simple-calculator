import { useEffect } from 'react';
import { formatNumber } from '../calculator/format';
import type { Key } from '../calculator/reducer';
import { useCalculator } from '../calculator/useCalculator';
import { Display } from './Display';
import { Keypad, OPERATOR_SYMBOLS } from './Keypad';
import { Toolbar } from './Toolbar';

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
  const { state, press, paste, showError } = useCalculator();

  const shownValue = state.overwrite ? formatNumber(state.entry) : state.entry;
  // Copying gives what's on the display, so a result shown as 1 doesn't arrive
  // somewhere else as 0.9999… A half-typed "5." is copied as "5".
  const copyText = state.error ? null : shownValue.replace(/\.$/, '');

  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      // Selected text copies as usual.
      if (copyText === null || window.getSelection()?.toString()) return;
      event.clipboardData?.setData('text/plain', copyText);
      event.preventDefault();
    }
    function onPaste(event: ClipboardEvent) {
      event.preventDefault();
      paste(event.clipboardData?.getData('text/plain') ?? '');
    }
    window.addEventListener('copy', onCopy);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('paste', onPaste);
    };
  }, [copyText, paste]);

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

  const expression = state.stack
    .map(({ value, op }) => `${formatNumber(value)} ${OPERATOR_SYMBOLS[op]}`)
    .join(' ');
  const busy = state.request !== null;

  return (
    <section className="calculator" aria-label="Calculator" aria-busy={busy}>
      <Toolbar copyText={copyText} onPaste={paste} onError={showError} busy={busy} />
      <Display
        expression={expression}
        value={shownValue}
        exactValue={state.entry}
        error={state.error}
      />
      <Keypad
        onPress={press}
        busy={busy}
        activeOperator={state.operandEntered ? null : (state.stack.at(-1)?.op ?? null)}
      />
    </section>
  );
}
