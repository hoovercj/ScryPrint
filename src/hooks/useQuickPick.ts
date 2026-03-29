import { useState, useCallback, useEffect } from 'react';
import { DEFAULT_STARRED, type DefaultCard } from '../lib/defaults.ts';
import { searchCards, getCardById, getImageUri } from '../lib/scryfall.ts';

const STARRED_KEY = 'scryprint_starred';
const RECENTS_KEY = 'scryprint_recents';
const MAX_RECENTS = 20;

export interface QuickPickCard {
  id: string;       // Scryfall card ID, or keyword name for keyword counters
  name: string;
  type: string;     // Type filter category
  imageUri?: string; // Small image URL
  query?: string;    // Scryfall query that found this card
  scryfallId?: string; // Direct Scryfall ID for cards unsearchable by query
  faceIndex?: number; // For DFCs — which face to display (0 = front, 1 = back)
}

function loadStarred(): QuickPickCard[] {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    if (raw) {
      const parsed: QuickPickCard[] = JSON.parse(raw);
      // Sync default cards with current definitions (migrates old query → scryfallId, etc.)
      const defaultsByName = new Map(DEFAULT_STARRED.map(d => [d.name, d]));
      let migrated = false;
      const result = parsed.map(card => {
        if (!card.id.startsWith('default_')) return card;
        const def = defaultsByName.get(card.name);
        if (!def) return card;
        if (card.query === def.query && card.scryfallId === def.scryfallId && card.faceIndex === def.faceIndex) return card;
        migrated = true;
        return { ...card, query: def.query, scryfallId: def.scryfallId, faceIndex: def.faceIndex };
      });
      if (migrated) localStorage.setItem(STARRED_KEY, JSON.stringify(result));
      return result;
    }
  } catch { /* ignore */ }

  // Seed from defaults on first load
  const seeded: QuickPickCard[] = DEFAULT_STARRED.map((d: DefaultCard) => ({
    id: `default_${d.name}`,
    name: d.name,
    type: d.type,
    query: d.query,
    scryfallId: d.scryfallId,
    faceIndex: d.faceIndex,
  }));
  localStorage.setItem(STARRED_KEY, JSON.stringify(seeded));
  return seeded;
}

function loadRecents(): QuickPickCard[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function useQuickPick() {
  const [starred, setStarred] = useState<QuickPickCard[]>(loadStarred);
  const [recents, setRecents] = useState<QuickPickCard[]>(loadRecents);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STARRED_KEY, JSON.stringify(starred));
  }, [starred]);

  useEffect(() => {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  }, [recents]);

  const [resolveGen, setResolveGen] = useState(0);

  // Resolve image URIs for default starred cards that don't have them yet
  useEffect(() => {
    const unresolvedDefaults = starred.filter(
      s => s.id.startsWith('default_') && !s.imageUri && (s.query || s.scryfallId)
    );
    if (unresolvedDefaults.length === 0) return;

    let cancelled = false;

    async function resolveImages() {
      const updates: Record<string, string> = {};
      for (const card of unresolvedDefaults) {
        if (cancelled) return;
        try {
          // Small delay between requests to respect rate limits
          await new Promise(r => setTimeout(r, 120));
          let scryfallCard;
          if (card.scryfallId) {
            scryfallCard = await getCardById(card.scryfallId);
          } else {
            const result = await searchCards(card.query!);
            scryfallCard = result.data[0];
          }
          if (scryfallCard) {
            const imgUri = getImageUri(scryfallCard, 'small', card.faceIndex);
            if (imgUri) {
              updates[card.id] = imgUri;
            }
          }
        } catch {
          // Skip failures — will retry next session
        }
      }

      if (cancelled || Object.keys(updates).length === 0) return;

      setStarred(prev => {
        const next = prev.map(c =>
          updates[c.id] ? { ...c, imageUri: updates[c.id] } : c
        );
        return next;
      });
    }

    resolveImages();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveGen]);

  const star = useCallback((card: QuickPickCard) => {
    setStarred(prev => {
      if (prev.some(c => c.id === card.id)) return prev;
      return [card, ...prev];
    });
  }, []);

  const unstar = useCallback((cardId: string) => {
    setStarred(prev => prev.filter(c => c.id !== cardId));
  }, []);

  const isStarred = useCallback((cardId: string) => {
    return starred.some(c => c.id === cardId);
  }, [starred]);

  const reorderStarred = useCallback((fromIndex: number, toIndex: number) => {
    setStarred(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const addRecent = useCallback((card: QuickPickCard) => {
    setRecents(prev => {
      const filtered = prev.filter(c => c.id !== card.id);
      return [card, ...filtered].slice(0, MAX_RECENTS);
    });
  }, []);

  const updateImageByName = useCallback((cardName: string, imageUri: string) => {
    setStarred(prev => {
      const idx = prev.findIndex(c => c.name === cardName);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], imageUri };
      return next;
    });
    setRecents(prev => {
      let changed = false;
      const next = prev.map(c => {
        if (c.name === cardName) { changed = true; return { ...c, imageUri }; }
        return c;
      });
      return changed ? next : prev;
    });
  }, []);

  const restoreDefaults = useCallback(() => {
    setStarred(prev => {
      const existing = new Set(prev.map(c => c.name));
      const missing = DEFAULT_STARRED.filter(d => !existing.has(d.name));
      if (missing.length === 0) return prev;
      // Re-insert missing defaults at their canonical positions
      const result = [...prev];
      const defaultNames = DEFAULT_STARRED.map(d => d.name);
      for (const d of missing) {
        const canonicalIdx = defaultNames.indexOf(d.name);
        // Find the best insert position: after the last default that precedes this one
        let insertAt = result.length;
        for (let i = canonicalIdx - 1; i >= 0; i--) {
          const precedingIdx = result.findIndex(c => c.name === defaultNames[i]);
          if (precedingIdx !== -1) {
            insertAt = precedingIdx + 1;
            break;
          }
        }
        result.splice(insertAt, 0, { id: `default_${d.name}`, name: d.name, type: d.type, query: d.query, scryfallId: d.scryfallId, faceIndex: d.faceIndex });
      }
      return result;
    });
    // Trigger image resolution for restored defaults
    setResolveGen(g => g + 1);
  }, []);

  return { starred, recents, star, unstar, isStarred, addRecent, updateImageByName, reorderStarred, restoreDefaults };
}
