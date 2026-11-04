import type { BinaryOperator } from '../api/client';
import type { Key } from '../calculator/reducer';

export const OPERATOR_SYMBOLS: Record<BinaryOperator, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
};

interface KeyDefinition {
  key: Key;
  label: string;
  /** What a screen reader announces. Digits and the point read fine as they are. */
  name?: string;
  kind: 'number' | 'function' | 'operator' | 'equals';
  className?: string;
}

const KEYS: KeyDefinition[] = [
  { key: 'clear', label: 'C', name: 'Clear', kind: 'function' },
  { key: 'backspace', label: '⌫', name: 'Backspace', kind: 'function' },
  { key: 'negate', label: '±', name: 'Change sign', kind: 'function' },
  { key: 'divide', label: '÷', name: 'Divide', kind: 'operator' },

  { key: 'sqrt', label: '√', name: 'Square root', kind: 'function' },
  { key: 'power', label: 'xʸ', name: 'Power', kind: 'function' },
  { key: 'percent', label: '%', name: 'Percent', kind: 'function' },
  { key: 'multiply', label: '×', name: 'Multiply', kind: 'operator' },

  { key: '7', label: '7', kind: 'number' },
  { key: '8', label: '8', kind: 'number' },
  { key: '9', label: '9', kind: 'number' },
  { key: 'subtract', label: '−', name: 'Subtract', kind: 'operator' },

  { key: '4', label: '4', kind: 'number' },
  { key: '5', label: '5', kind: 'number' },
  { key: '6', label: '6', kind: 'number' },
  { key: 'add', label: '+', name: 'Add', kind: 'operator' },

  { key: '1', label: '1', kind: 'number' },
  { key: '2', label: '2', kind: 'number' },
  { key: '3', label: '3', kind: 'number' },
  { key: 'equals', label: '=', name: 'Equals', kind: 'equals', className: 'key-tall' },

  { key: '0', label: '0', kind: 'number', className: 'key-wide' },
  { key: '.', label: '.', name: 'Decimal point', kind: 'number' },
];

const OPERATOR_KEYS: readonly Key[] = Object.keys(OPERATOR_SYMBOLS) as BinaryOperator[];

interface KeypadProps {
  onPress: (key: Key) => void;
  busy: boolean;
  /** The operator waiting for its second number, shown as pressed. */
  activeOperator: BinaryOperator | null;
}

export function Keypad({ onPress, busy, activeOperator }: KeypadProps) {
  return (
    <div className="keypad">
      {KEYS.map(({ key, label, name, kind, className }) => (
        <button
          key={key}
          type="button"
          className={['key', `key-${kind}`, className].filter(Boolean).join(' ')}
          aria-label={name}
          aria-pressed={OPERATOR_KEYS.includes(key) ? key === activeOperator : undefined}
          // aria-disabled rather than disabled, which would drop keyboard focus on
          // every request. The reducer ignores these presses while one is running.
          aria-disabled={busy && key !== 'clear'}
          onClick={() => onPress(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
