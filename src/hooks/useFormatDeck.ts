import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ScryfallCard } from '../lib/scryfall.ts';

export interface DeckEntry {
  card: ScryfallCard;
  qty: number;
}

export interface UseFormatDeckOptions {
  storageKey: string;
  maxCopies: number;
  minDeckSize: number;
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useFormatDeck({ storageKey, maxCopies, minDeckSize }: UseFormatDeckOptions) {
  // === Build State (persisted in localStorage) ===
  const [entries, setEntries] = useState<DeckEntry[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      return JSON.parse(raw) as DeckEntry[];
    } catch { return []; }
  });

  // === Play State (persisted in localStorage) ===
  const [drawPile, setDrawPile] = useState<ScryfallCard[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey + '_play') ?? 'null')?.drawPile ?? []; }
    catch { return []; }
  });
  const [drawIndex, setDrawIndex] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey + '_play') ?? 'null')?.drawIndex ?? 0; }
    catch { return 0; }
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey + '_play') ?? 'null')?.isPlaying ?? false; }
    catch { return false; }
  });

  // Persist deck entries to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries, storageKey]);

  // Persist play state to localStorage
  useEffect(() => {
    const playKey = storageKey + '_play';
    if (isPlaying) {
      localStorage.setItem(playKey, JSON.stringify({ drawPile, drawIndex, isPlaying }));
    } else {
      localStorage.removeItem(playKey);
    }
  }, [drawPile, drawIndex, isPlaying, storageKey]);

  // Derived
  const deckSize = useMemo(() => entries.reduce((s, e) => s + e.qty, 0), [entries]);
  const isLegal = deckSize >= minDeckSize;
  const hasDeck = entries.length > 0;

  // === Build methods ===
  const getQty = useCallback(
    (cardId: string) => entries.find(e => e.card.id === cardId)?.qty ?? 0,
    [entries],
  );

  const addCard = useCallback((card: ScryfallCard) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.card.id === card.id);
      if (idx >= 0) {
        if (prev[idx].qty >= maxCopies) return prev;
        return prev.map((e, i) => i === idx ? { ...e, qty: e.qty + 1 } : e);
      }
      return [...prev, { card, qty: 1 }];
    });
  }, [maxCopies]);

  const removeCard = useCallback((cardId: string) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.card.id === cardId);
      if (idx < 0) return prev;
      if (prev[idx].qty <= 1) return prev.filter((_, i) => i !== idx);
      return prev.map((e, i) => i === idx ? { ...e, qty: e.qty - 1 } : e);
    });
  }, []);

  const clearDeck = useCallback(() => setEntries([]), []);

  const addAll = useCallback((cards: ScryfallCard[]) => {
    const map = new Map<string, DeckEntry>();
    for (const c of cards) {
      const existing = map.get(c.id);
      if (existing) {
        existing.qty = Math.min(existing.qty + 1, maxCopies);
      } else {
        map.set(c.id, { card: c, qty: 1 });
      }
    }
    setEntries(Array.from(map.values()));
  }, [maxCopies]);

  // === Play methods ===
  const shuffleAndStart = useCallback((autoReveal = false) => {
    const expanded: ScryfallCard[] = [];
    for (const e of entries) {
      for (let i = 0; i < e.qty; i++) expanded.push(e.card);
    }
    setDrawPile(fisherYates(expanded));
    setDrawIndex(autoReveal ? 1 : 0);
    setIsPlaying(true);
  }, [entries]);

  const drawNext = useCallback(() => {
    setDrawIndex(prev => Math.min(prev + 1, drawPile.length));
  }, [drawPile.length]);

  const currentCard = drawIndex > 0 && drawIndex <= drawPile.length
    ? drawPile[drawIndex - 1]
    : null;

  const played = useMemo(
    () => (drawIndex > 1 ? drawPile.slice(0, drawIndex - 1).reverse() : []),
    [drawPile, drawIndex],
  );

  const remaining = isPlaying ? drawPile.length - drawIndex : 0;
  const isExhausted = isPlaying && drawPile.length > 0 && drawIndex >= drawPile.length;

  const endGame = useCallback(() => {
    setIsPlaying(false);
    setDrawPile([]);
    setDrawIndex(0);
  }, []);

  const reshuffle = useCallback(() => {
    const expanded: ScryfallCard[] = [];
    for (const e of entries) {
      for (let i = 0; i < e.qty; i++) expanded.push(e.card);
    }
    setDrawPile(fisherYates(expanded));
    setDrawIndex(1);
  }, [entries]);

  return {
    // Build
    entries, deckSize, isLegal, hasDeck, minDeckSize, maxCopies,
    getQty, addCard, removeCard, clearDeck, addAll,
    // Play
    isPlaying, shuffleAndStart, drawNext, currentCard, played, remaining, isExhausted, endGame, reshuffle,
    drawPile, drawIndex,
  };
}
