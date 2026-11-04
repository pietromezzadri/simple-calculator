import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTheme } from '../theme/useTheme';

const COPIED_MESSAGE_MS = 1500;

interface ToolbarProps {
  /** What Copy puts on the clipboard, or null when there's nothing to copy. */
  copyText: string | null;
  onPaste: (text: string) => void;
  onError: (message: string) => void;
  busy: boolean;
}

export function Toolbar({ copyText, onPaste, onError, busy }: ToolbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (copyText === null) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
    } catch {
      onError('Your browser blocked copying. Try Ctrl+C or ⌘C instead.');
    }
  }

  async function paste() {
    if (busy) return;
    try {
      onPaste(await navigator.clipboard.readText());
    } catch {
      onError('Your browser blocked pasting. Try Ctrl+V or ⌘V instead.');
    }
  }

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <div className="toolbar" onKeyDown={keepEnterForButton} onClick={releaseFocusAfterMouseClick}>
      <button type="button" className="tool" aria-disabled={copyText === null} onClick={copy}>
        <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <button type="button" className="tool" aria-disabled={busy} onClick={paste}>
        Paste
      </button>
      <button
        type="button"
        className="tool tool-theme"
        aria-label={`Switch to ${nextTheme} theme`}
        title={`Switch to ${nextTheme} theme`}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}

/** Enter on a focused toolbar button presses it, rather than meaning equals. */
function keepEnterForButton(event: KeyboardEvent) {
  if (event.key === 'Enter') event.stopPropagation();
}

/**
 * After a mouse click focus would stay on the button, and the Enter ending the
 * next calculation would press it again. Keyboard users keep their place: their
 * clicks have a detail of 0.
 */
function releaseFocusAfterMouseClick(event: MouseEvent) {
  if (event.detail > 0 && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}
