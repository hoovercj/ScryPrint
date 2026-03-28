import { useState, useEffect, useRef, useCallback } from 'react';
import { searchCards, type ScryfallCard, type ScryfallList } from '../lib/scryfall.ts';

export function useScryfall(query: string, debounceMs = 300) {
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCards, setTotalCards] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      setTotalCards(0);
      return;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data: ScryfallList = await searchCards(query);
        if (!controller.signal.aborted) {
          setResults(data.data);
          setTotalCards(data.total_cards);
          setLoading(false);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Search failed');
          setResults([]);
          setTotalCards(0);
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [query, debounceMs]);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    setTotalCards(0);
  }, []);

  return { results, loading, error, totalCards, clear };
}
