export type BinaryOperator = 'add' | 'subtract' | 'multiply' | 'divide' | 'power';

/** One call to the API. Operands are strings so that no digits are lost. */
export type ApiCall =
  | { op: BinaryOperator | 'percentage'; a: string; b: string }
  | { op: 'sqrt'; a: string };

const DEFAULT_TIMEOUT_MS = 5000;

/** A failed calculation. `message` is always fit to show to the user. */
export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

interface CalculateOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Sends one calculation and returns its exact result. Every failure becomes an
 * ApiError, except cancellation through `signal`, which rethrows as AbortError.
 */
export async function calculate(call: ApiCall, options: CalculateOptions = {}): Promise<string> {
  const { op, ...operands } = call;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  let body: unknown;
  try {
    response = await fetch(`/api/v1/${op}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(operands),
      signal,
    });
    body = await response.json().catch(() => null);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timeout.aborted) {
      throw new ApiError('timeout', 'The calculator service took too long to answer. Please try again.');
    }
    throw new ApiError('network', "Can't reach the calculator service. Check your connection and try again.");
  }

  if (response.ok && isResultBody(body)) return body.result;
  if (isErrorBody(body)) throw new ApiError(body.error.code, body.error.message);
  throw new ApiError('bad_response', 'The calculator service is unavailable. Please try again.');
}

function isResultBody(body: unknown): body is { result: string } {
  return typeof (body as { result?: unknown } | null)?.result === 'string';
}

function isErrorBody(body: unknown): body is { error: { code: string; message: string } } {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return typeof error?.code === 'string' && typeof error.message === 'string';
}
