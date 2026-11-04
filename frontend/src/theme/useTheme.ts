import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

// index.html reads this too, to apply the saved theme before the first paint.
const STORAGE_KEY = 'calculator-theme';

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function chosenTheme(): Theme | undefined {
  return document.documentElement.dataset.theme as Theme | undefined;
}

function activeTheme(): Theme {
  return chosenTheme() ?? (systemQuery().matches ? 'dark' : 'light');
}

/**
 * The theme follows the system until the user picks one, and that pick is then
 * remembered. The CSS themes on the `data-theme` attribute of the root element.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(activeTheme);

  useEffect(() => {
    const query = systemQuery();
    const onSystemChange = () => setTheme(activeTheme());
    query.addEventListener('change', onSystemChange);
    return () => query.removeEventListener('change', onSystemChange);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = activeTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked. The theme still applies until the page is closed.
    }
    setTheme(next);
  }, []);

  return { theme, toggleTheme };
}
