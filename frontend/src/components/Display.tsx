interface DisplayProps {
  /** The calculation so far, such as "200 +". */
  expression: string;
  value: string;
  /** The value before rounding for display, available on hover. */
  exactValue: string;
  error: string | null;
}

function sizeFor(value: string): 'large' | 'medium' | 'small' {
  if (value.length <= 11) return 'large';
  return value.length <= 18 ? 'medium' : 'small';
}

export function Display({ expression, value, exactValue, error }: DisplayProps) {
  return (
    <div className="display">
      <div className="display-expression" data-testid="expression">
        {expression}
      </div>
      {error ? (
        <p className="display-error" role="alert">
          {error}
        </p>
      ) : (
        <output className="display-value" data-size={sizeFor(value)} title={exactValue}>
          {value}
        </output>
      )}
    </div>
  );
}
