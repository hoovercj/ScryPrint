import { useState, useCallback } from 'react';

const STORAGE_KEY = 'scryprint_printing_prefs';

/** Maps card name → preferred Scryfall printing ID */
type PrintingPrefs = Record<string, string>;

function load(): PrintingPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function usePrintingPrefs() {
  const [prefs, setPrefs] = useState<PrintingPrefs>(load);

  const setPreferred = useCallback((cardName: string, printingId: string) => {
    setPrefs(prev => {
      const next = { ...prev, [cardName]: printingId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getPreferred = useCallback((cardName: string): string | undefined => {
    return prefs[cardName];
  }, [prefs]);

  return { getPreferred, setPreferred };
}
