import { useCallback, useEffect, useReducer } from 'react';
import { ApiError, calculate } from '../api/client';
import { initialState, reducer, type Key } from './reducer';

/**
 * Runs the calculator: the reducer decides what should happen, and this hook
 * sends whichever request it asks for. Clearing the state's request cancels
 * the one in flight, through the effect's cleanup.
 */
export function useCalculator() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { request } = state;

  useEffect(() => {
    if (!request) return;

    const controller = new AbortController();
    calculate(request.call, { signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted) dispatch({ type: 'resolved', result });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'rejected', message: messageFor(error) });
      },
    );
    return () => controller.abort();
  }, [request]);

  const press = useCallback((key: Key) => dispatch({ type: 'press', key }), []);

  return { state, press };
}

function messageFor(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}
