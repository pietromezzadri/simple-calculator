import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Calculator } from './Calculator';

type Handler = (op: string, operands: { a: string; b?: string }) => { status?: number; body: unknown };

/** Arithmetic good enough for these tests, which check the UI rather than the maths. */
const fakeBackend: Handler = (op, { a, b }) => {
  const x = Number(a);
  const y = Number(b);
  switch (op) {
    case 'add':
      return { body: { result: String(x + y) } };
    case 'subtract':
      return { body: { result: String(x - y) } };
    case 'multiply':
      return { body: { result: String(x * y) } };
    case 'power':
      return { body: { result: String(x ** y) } };
    case 'percentage':
      return { body: { result: String((x * y) / 100) } };
    case 'sqrt':
      if (x < 0) {
        const message = 'Cannot take the square root of a negative number.';
        return { status: 422, body: { error: { code: 'negative_sqrt', message } } };
      }
      return { body: { result: String(Math.sqrt(x)) } };
    case 'divide':
      if (y === 0) {
        return { status: 422, body: { error: { code: 'division_by_zero', message: 'Cannot divide by zero.' } } };
      }
      return { body: { result: String(x / y) } };
    default:
      throw new Error(`unexpected operation ${op}`);
  }
};

function serve(handler: Handler) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const op = url.replace('/api/v1/', '');
    const { status = 200, body } = handler(op, JSON.parse(init.body as string));
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function setup() {
  render(<Calculator />);
  return userEvent.setup();
}

async function click(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  for (const name of names) {
    await user.click(screen.getByRole('button', { name }));
  }
}

const value = () => screen.getByRole('status');

describe('Calculator', () => {
  beforeEach(() => {
    serve(fakeBackend);
  });

  it('starts at zero with every key available', () => {
    setup();
    expect(value()).toHaveTextContent('0');
    expect(screen.getAllByRole('button')).toHaveLength(22);
  });

  it('adds two numbers through the API', async () => {
    const user = setup();
    await click(user, '1', '2', 'Add', '3', 'Equals');
    await waitFor(() => expect(value()).toHaveTextContent(/^15$/));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('expression')).toBeEmptyDOMElement();
  });

  it.each([
    ['Subtract', '5'],
    ['Multiply', '50'],
    ['Divide', '2'],
    ['Power', '100000'],
  ])('supports %s', async (operator, expected) => {
    const user = setup();
    await click(user, '1', '0', operator, '5', 'Equals');
    await waitFor(() => expect(value()).toHaveTextContent(new RegExp(`^${expected}$`)));
  });

  it('shows the calculation so far and marks the operator', async () => {
    const user = setup();
    await click(user, '2', '0', '0', 'Add');
    expect(screen.getByTestId('expression')).toHaveTextContent('200 +');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('aria-pressed', 'true');

    await click(user, '1');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('chains left to right, without operator precedence', async () => {
    const user = setup();
    await click(user, '2', 'Add', '3', 'Multiply');
    await waitFor(() => expect(screen.getByTestId('expression')).toHaveTextContent('5 ×'));
    await click(user, '4', 'Equals');
    await waitFor(() => expect(value()).toHaveTextContent(/^20$/));
  });

  it('takes the square root of the entry', async () => {
    const user = setup();
    await click(user, '9', 'Square root');
    await waitFor(() => expect(value()).toHaveTextContent(/^3$/));
  });

  it('adds a percentage of the running total', async () => {
    const user = setup();
    await click(user, '2', '0', '0', 'Add', '1', '0', 'Percent');
    await waitFor(() => expect(value()).toHaveTextContent(/^20$/));
    await click(user, 'Equals');
    await waitFor(() => expect(value()).toHaveTextContent(/^220$/));
  });

  it('rounds long results for display but keeps the exact value', async () => {
    const third = '0.3333333333333333333333333333333333';
    const fetchMock = serve((op) => ({ body: { result: op === 'divide' ? third : '1' } }));
    const user = setup();

    await click(user, '1', 'Divide', '3', 'Equals');

    await waitFor(() => expect(value()).toHaveTextContent(/^0\.3333333333333333$/));
    expect(value()).toHaveAttribute('title', third);

    await click(user, 'Multiply', '3', 'Equals');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.lastCall?.[1].body as string)).toEqual({ a: third, b: '3' });
  });

  it('shows what is being typed as it is, trailing point included', async () => {
    const user = setup();
    await click(user, '5', 'Decimal point');
    expect(value()).toHaveTextContent(/^5\.$/);
  });

  describe('errors', () => {
    it('shows division by zero as a message, not a result', async () => {
      const user = setup();
      await click(user, '5', 'Divide', '0', 'Equals');

      expect(await screen.findByRole('alert')).toHaveTextContent('Cannot divide by zero.');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('clears the message on the next key and carries on', async () => {
      const user = setup();
      await click(user, '5', 'Divide', '0', 'Equals');
      await screen.findByRole('alert');

      await click(user, '2');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(value()).toHaveTextContent(/^2$/);

      await click(user, 'Equals');
      await waitFor(() => expect(value()).toHaveTextContent(/^2\.5$/));
    });

    it('shows the square root error', async () => {
      const user = setup();
      await click(user, '4', 'Change sign', 'Square root');
      expect(await screen.findByRole('alert')).toHaveTextContent('negative number');
    });

    it('has its own message for a network failure, and can retry', async () => {
      const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
      fetchMock.mockResolvedValueOnce(new Response('{"result":"3"}'));
      vi.stubGlobal('fetch', fetchMock);
      const user = setup();

      await click(user, '1', 'Add', '2', 'Equals');
      expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the calculator service");

      await click(user, 'Equals');
      await waitFor(() => expect(value()).toHaveTextContent(/^3$/));
    });

  });

  describe('while a request is running', () => {
    function holdResponse() {
      let release: (response: Response) => void = () => {};
      const fetchMock = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            release = resolve;
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      );
      vi.stubGlobal('fetch', fetchMock);
      return { fetchMock, release: (response: Response) => release(response) };
    }

    it('marks keys unavailable, except clear, and ignores them', async () => {
      const { fetchMock, release } = holdResponse();
      const user = setup();
      await click(user, '1', 'Add', '2', 'Equals');

      expect(screen.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'true');
      const keypad = within(screen.getByRole('region', { name: 'Calculator' }));
      expect(keypad.getByRole('button', { name: 'Add' })).toHaveAttribute('aria-disabled', 'true');
      expect(keypad.getByRole('button', { name: 'Clear' })).toHaveAttribute('aria-disabled', 'false');

      await click(user, 'Equals', '9');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      release(new Response('{"result":"3"}'));
      await waitFor(() => expect(value()).toHaveTextContent(/^3$/));
      expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('aria-disabled', 'false');
    });

    it('clear cancels the request and its answer is dropped', async () => {
      const { fetchMock } = holdResponse();
      const user = setup();
      await click(user, '1', 'Add', '2', 'Equals');

      await click(user, 'Clear');

      const { signal } = fetchMock.mock.calls[0]![1];
      expect(signal?.aborted).toBe(true);
      expect(value()).toHaveTextContent(/^0$/);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('keyboard', () => {
    it('does a whole calculation from the keyboard', async () => {
      const user = setup();
      await user.keyboard('12.5*2{Enter}');
      await waitFor(() => expect(value()).toHaveTextContent(/^25$/));
    });

    it.each([
      ['+', 'add'],
      ['-', 'subtract'],
      ['x', 'multiply'],
      ['/', 'divide'],
      ['^', 'power'],
    ])('%s chooses %s', async (typed, op) => {
      const fetchMock = serve(fakeBackend);
      const user = setup();
      await user.keyboard(`8${typed}2=`);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/v1/${op}`, expect.anything()));
    });

    it('has keys for the other functions', async () => {
      const user = setup();
      await user.keyboard('1,5{Backspace}');
      expect(value()).toHaveTextContent(/^1\.$/);

      await user.keyboard('5n');
      expect(value()).toHaveTextContent(/^-1\.5$/);

      await user.keyboard('{Escape}9r');
      await waitFor(() => expect(value()).toHaveTextContent(/^3$/));

      await user.keyboard('{Delete}50%');
      await waitFor(() => expect(value()).toHaveTextContent(/^0\.5$/));
    });

    it('Enter on a focused key means equals, not a click on that key', async () => {
      const user = setup();
      await click(user, '2', 'Add', '3');
      expect(screen.getByRole('button', { name: '3' })).toHaveFocus();

      await user.keyboard('{Enter}');

      await waitFor(() => expect(value()).toHaveTextContent(/^5$/));
    });

    it('leaves browser shortcuts and unrelated keys alone', async () => {
      const user = setup();
      await user.keyboard('{Control>}5{/Control}q');
      expect(value()).toHaveTextContent(/^0$/);
    });
  });
});
