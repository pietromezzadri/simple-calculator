import { describe, expect, it, vi } from 'vitest';
import { ApiError, calculate } from './client';

function respondWith(body: string, status = 200) {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** A fetch that never answers, but honours its abort signal as the real one does. */
function neverRespond() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    ),
  );
}

async function failure(call: Promise<string>): Promise<unknown> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to fail');
}

describe('calculate', () => {
  it('posts a binary operation and returns its result as sent', async () => {
    const fetchMock = respondWith('{"result":"0.3333333333333333333333333333333333"}');

    const result = await calculate({ op: 'divide', a: '1', b: '3' });

    expect(result).toBe('0.3333333333333333333333333333333333');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/divide',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"a":"1","b":"3"}',
      }),
    );
  });

  it('posts a one-number operation', async () => {
    const fetchMock = respondWith('{"result":"3"}');

    await calculate({ op: 'sqrt', a: '9' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/sqrt',
      expect.objectContaining({ body: '{"a":"9"}' }),
    );
  });

  it('turns an API error into an ApiError with its code and message', async () => {
    respondWith('{"error":{"code":"division_by_zero","message":"Cannot divide by zero."}}', 422);

    const error = await failure(calculate({ op: 'divide', a: '1', b: '0' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'division_by_zero', message: 'Cannot divide by zero.' });
  });

  it.each([
    ['a body that is not JSON', 'Bad Gateway', 502],
    ['an empty body', '', 500],
    ['JSON of the wrong shape', '{"nope":1}', 200],
    ['a null body', 'null', 200],
    ['a numeric result', '{"result":5}', 200],
    ['a malformed error', '{"error":{"code":1}}', 500],
  ])('reports %s as a bad response', async (_name, body, status) => {
    respondWith(body, status);

    const error = await failure(calculate({ op: 'add', a: '1', b: '2' }));

    expect(error).toMatchObject({ code: 'bad_response' });
  });

  it('does not accept a result from a failed response', async () => {
    respondWith('{"result":"5"}', 500);

    const error = await failure(calculate({ op: 'add', a: '1', b: '2' }));

    expect(error).toMatchObject({ code: 'bad_response' });
  });

  it('reports a failed connection as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await failure(calculate({ op: 'add', a: '1', b: '2' }));

    expect(error).toMatchObject({ code: 'network' });
  });

  it('gives up after the timeout', async () => {
    neverRespond();

    const error = await failure(calculate({ op: 'add', a: '1', b: '2' }, { timeoutMs: 5 }));

    expect(error).toMatchObject({ code: 'timeout' });
  });

  it('rethrows cancellation rather than reporting a failure', async () => {
    neverRespond();
    const controller = new AbortController();

    const pending = failure(calculate({ op: 'add', a: '1', b: '2' }, { signal: controller.signal }));
    controller.abort();
    const error = await pending;

    expect(error).not.toBeInstanceOf(ApiError);
  });
});
