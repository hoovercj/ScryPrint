import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import autoAnimate from '@formkit/auto-animate';
import { usePrinter } from '../hooks/usePrinter.ts';
import { useSettings } from '../context/SettingsContext.tsx';
import { useScryfall } from '../hooks/useScryfall.ts';
import { useQuickPick } from '../hooks/useQuickPick.ts';
import { searchCards, getCardById, getImageUri, fetchCardArt, type ScryfallCard } from '../lib/scryfall.ts';
import { renderCardToCanvas, renderKeywordCounter } from '../lib/printer/thermalRenderer.ts';
import { KEYWORD_COUNTERS, type KeywordCounter } from '../lib/keywordCounters.ts';
import { TYPE_FILTERS, type TypeFilterLabel } from '../lib/defaults.ts';
import { usePrintingPrefs } from '../hooks/usePrintingPrefs.ts';
import styles from './Browse.module.css';

export function Browse() {
  const { status, print } = usePrinter();
  const settings = useSettings();
  const { starred, recents, star, unstar, isStarred, addRecent, updateImageByName, reorderStarred, restoreDefaults } = useQuickPick();
  const { getPreferred, setPreferred } = usePrintingPrefs();

  const [activeFilter, setActiveFilter] = useState<TypeFilterLabel>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | undefined>(undefined);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordCounter | null>(null);
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loadingPrintings, setLoadingPrintings] = useState(false);
  const [activePrinting, setActivePrinting] = useState<ScryfallCard | null>(null);
  const [message, setMessage] = useState('');
  const [includeReminder, setIncludeReminder] = useState(false);

  const isKeywordMode = activeFilter === 'Keyword Counter';
  const filterQuery = TYPE_FILTERS.find(f => f.label === activeFilter)?.query || '';

  // Build Scryfall search query
  const fullQuery = useMemo(() => {
    if (isKeywordMode) return '';
    const parts: string[] = [];
    if (filterQuery) parts.push(filterQuery);
    if (searchQuery.trim()) parts.push(searchQuery.trim());
    // If a type filter is active with no search text, search the filter itself
    if (parts.length === 0) return '';
    return parts.join(' ');
  }, [searchQuery, filterQuery, isKeywordMode]);

  const { results: searchResults, loading: searchLoading } = useScryfall(fullQuery);

  // Keyword counters with starred at top
  const filteredKeywords = useMemo(() => {
    if (!isKeywordMode) return [];
    const list = KEYWORD_COUNTERS as readonly KeywordCounter[];
    // Starred keywords at top
    const starredIds = new Set(starred.filter(s => s.type === 'Keyword Counter').map(s => s.name));
    const starredKws = list.filter(k => starredIds.has(k.keyword));
    const unstarredKws = list.filter(k => !starredIds.has(k.keyword));
    return [...starredKws, ...unstarredKws];
  }, [isKeywordMode, starred]);

  // Filter starred by active type
  const filteredStarred = useMemo(() => {
    if (activeFilter === 'All') return starred;
    return starred.filter(c => c.type === activeFilter);
  }, [starred, activeFilter]);

  const handleSelectCard = useCallback(async (card: ScryfallCard, faceIndex?: number) => {
    setSelectedCard(card);
    setSelectedFaceIndex(faceIndex);
    setSelectedKeyword(null);
    setPrintings([]);
    setLoadingPrintings(false);

    // Check for a preferred printing
    const preferredId = getPreferred(card.name);
    if (preferredId && preferredId !== card.id) {
      try {
        const preferred = await getCardById(preferredId);
        setActivePrinting(preferred);
      } catch {
        setActivePrinting(card);
      }
    } else {
      setActivePrinting(card);
    }

    // Auto-load printings in the background
    // Skip for dungeons and game markers (Monarch, City's Blessing, Day//Night, etc.)
    // whose type_line contains "Card" as a standalone type — unsearchable via Scryfall
    const tl = card.type_line ?? '';
    const isGameMarker = /(^|\/{2}\s*)Card(\s|$)/i.test(tl);
    if (!tl.startsWith('Dungeon') && !isGameMarker) {
      setLoadingPrintings(true);
      try {
        let typeHint = '';
        if (tl.startsWith('Plane ') || tl === 'Plane') typeHint = ' t:plane';
        else if (tl.startsWith('Phenomenon')) typeHint = ' t:phenomenon';
        else if (tl.includes('Scheme')) typeHint = ' t:scheme';
        else if (tl.startsWith('Emblem')) typeHint = ' t:emblem';
        else if (tl.startsWith('Token')) typeHint = ' t:token';
        const data = await searchCards(`!"${card.name}"${typeHint}`, 'prints', { rawQuery: true });
        setPrintings(data.data);
      } catch { /* silently fail */ }
      setLoadingPrintings(false);
    }
  }, [getPreferred]);

  const handleSelectKeyword = useCallback((kw: KeywordCounter) => {
    setSelectedKeyword(kw);
    setSelectedCard(null);
    setActivePrinting(null);
    setPrintings([]);
    setLoadingPrintings(false);
  }, []);

  const handleSelectPrinting = useCallback((printingId: string) => {
    const p = printings.find(c => c.id === printingId);
    if (!p || !selectedCard) return;
    setActivePrinting(p);
    setPreferred(selectedCard.name, p.id);
    const img = getImageUri(p, 'small');
    if (img) updateImageByName(selectedCard.name, img);
  }, [printings, selectedCard, setPreferred, updateImageByName]);

  const handlePrint = async () => {
    setMessage('Printing...');
    try {
      if (selectedKeyword) {
        const canvas = renderKeywordCounter(
          selectedKeyword.keyword,
          includeReminder ? selectedKeyword.reminderText : undefined
        );
        await print(canvas);
        addRecent({
          id: `kw_${selectedKeyword.keyword}`,
          name: selectedKeyword.keyword,
          type: 'Keyword Counter',
        });
        setMessage(`Printed: ${selectedKeyword.keyword}`);
        return;
      }

      const cardToPrint = activePrinting || selectedCard;
      if (!cardToPrint) return;

      let artImg: ImageBitmap | null = null;
      if (settings.printArt) {
        const artUrl = getImageUri(cardToPrint, 'art_crop', selectedFaceIndex);
        if (artUrl) {
          try { artImg = await fetchCardArt(artUrl); } catch { /* skip art */ }
        }
      }

      const canvas = renderCardToCanvas({
        name: cardToPrint.name,
        manaCost: cardToPrint.mana_cost,
        typeLine: cardToPrint.type_line,
        oracleText: cardToPrint.oracle_text,
        power: cardToPrint.power,
        toughness: cardToPrint.toughness,
      }, artImg);
      await print(canvas);

      const imgUri = getImageUri(cardToPrint, 'small');
      addRecent({
        id: cardToPrint.id,
        name: cardToPrint.name,
        type: activeFilter,
        imageUri: imgUri || undefined,
      });
      setMessage(`Printed: ${cardToPrint.name}`);
    } catch (e) {
      setMessage(`Print failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const closeDetail = () => {
    setSelectedCard(null);
    setSelectedKeyword(null);
    setActivePrinting(null);
    setPrintings([]);
    setLoadingPrintings(false);
  };

  const toggleStar = (card: ScryfallCard, e: React.MouseEvent) => {
    e.stopPropagation();
    const imgUri = getImageUri(card, 'small');
    if (isStarred(card.id)) {
      unstar(card.id);
    } else {
      star({
        id: card.id,
        name: card.name,
        type: activeFilter,
        imageUri: imgUri || undefined,
      });
    }
  };

  const toggleKeywordStar = (kw: KeywordCounter, e: React.MouseEvent) => {
    e.stopPropagation();
    const kwId = `kw_${kw.keyword}`;
    if (isStarred(kwId)) {
      unstar(kwId);
    } else {
      star({ id: kwId, name: kw.keyword, type: 'Keyword Counter' });
    }
  };

  // Drag-and-drop reorder for starred cards
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragIndexRef.current = idx;
    starredAnimCtrl.current?.disable();
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === idx) return;
    // Map filtered index to full starred array index
    const fromGlobal = starred.indexOf(filteredStarred[dragIndexRef.current]);
    const toGlobal = starred.indexOf(filteredStarred[idx]);
    if (fromGlobal === -1 || toGlobal === -1) return;
    reorderStarred(fromGlobal, toGlobal);
    dragIndexRef.current = idx;
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    starredAnimCtrl.current?.enable();
  };

  // Keyword drag-and-drop reorder (within starred keywords)
  const kwDragIndexRef = useRef<number | null>(null);
  const starredKeywordIds = useMemo(
    () => starred.filter(s => s.type === 'Keyword Counter').map(s => s.name),
    [starred]
  );

  const handleKwDragStart = (keyword: string) => {
    const idx = starredKeywordIds.indexOf(keyword);
    kwDragIndexRef.current = idx;
    keywordAnimCtrl.current?.disable();
  };

  const handleKwDragOver = (e: React.DragEvent, keyword: string) => {
    e.preventDefault();
    const fromKwIdx = kwDragIndexRef.current;
    const toKwIdx = starredKeywordIds.indexOf(keyword);
    if (fromKwIdx === null || fromKwIdx === toKwIdx || toKwIdx === -1) return;
    const fromGlobal = starred.findIndex(s => s.name === starredKeywordIds[fromKwIdx]);
    const toGlobal = starred.findIndex(s => s.name === keyword && s.type === 'Keyword Counter');
    if (fromGlobal === -1 || toGlobal === -1) return;
    reorderStarred(fromGlobal, toGlobal);
    kwDragIndexRef.current = toKwIdx;
  };

  const handleKwDragEnd = () => {
    kwDragIndexRef.current = null;
    keywordAnimCtrl.current?.enable();
  };

  const keywordListRef = useRef<HTMLDivElement>(null);
  const starredGridRef = useRef<HTMLDivElement>(null);
  const starredAnimCtrl = useRef<{ enable: () => void; disable: () => void } | null>(null);
  const keywordAnimCtrl = useRef<{ enable: () => void; disable: () => void } | null>(null);

  const displayCard = activePrinting || selectedCard;
  const displayImageUrl = displayCard ? getImageUri(displayCard, 'normal', selectedFaceIndex) : null;

  const hasSearch = searchQuery.trim().length > 0;
  const hasFilterResults = fullQuery.length > 0 && !isKeywordMode;
  const showSearchResults = hasFilterResults;
  const showKeywordResults = isKeywordMode;
  const showStarred = !isKeywordMode && filteredStarred.length > 0;

  useEffect(() => {
    const el = keywordListRef.current;
    if (el) {
      const ctrl = autoAnimate(el, { duration: 250, disrespectUserMotionPreference: true });
      keywordAnimCtrl.current = ctrl;
      return () => { keywordAnimCtrl.current = null; };
    }
  }, [showKeywordResults]);

  useEffect(() => {
    const el = starredGridRef.current;
    if (el) {
      const ctrl = autoAnimate(el, { duration: 250, disrespectUserMotionPreference: true });
      starredAnimCtrl.current = ctrl;
      return () => { starredAnimCtrl.current = null; };
    }
  }, [showStarred]);

  return (
    <div className={styles.page}>
      <h2 className={styles.header}>Browse & Print</h2>

      {/* Type filter chips */}
      <div className={styles.filters}>
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.label}
            className={styles.chip}
            data-active={activeFilter === f.label}
            onClick={() => { setActiveFilter(f.label); setSearchQuery(''); setMessage(''); }}
          >
            {f.display}
          </button>
        ))}
      </div>

      {/* Search (hidden for keyword counters) */}
      {!isKeywordMode && (
        <input
          className={styles.searchBox}
          type="text"
          placeholder="Search Scryfall..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      )}

      {/* Keyword counter list */}
      {showKeywordResults && (
        <div className={styles.keywordList} ref={keywordListRef}>
          {filteredKeywords.map((kw) => {
            const kwStarred = isStarred(`kw_${kw.keyword}`);
            return (
            <div
              key={kw.keyword}
              className={styles.keywordItem}
              onClick={() => handleSelectKeyword(kw)}
              draggable={kwStarred}
              onDragStart={() => handleKwDragStart(kw.keyword)}
              onDragOver={(e) => handleKwDragOver(e, kw.keyword)}
              onDragEnd={handleKwDragEnd}
            >
              <div className={styles.keywordContent}>
                <div className={styles.keywordName}>{kw.keyword}</div>
                <div className={styles.keywordReminder}>{kw.reminderText}</div>
              </div>
              <button
                className={styles.keywordStarBtn}
                data-starred={kwStarred}
                onClick={(e) => toggleKeywordStar(kw, e)}
              >
                {kwStarred ? '★' : '☆'}
              </button>
            </div>
            );
          })}
        </div>
      )}

      {/* Starred (always above search results) */}
      {showStarred && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Starred</span>
            <button className={styles.restoreLink} onClick={restoreDefaults}>Restore defaults</button>
          </div>
          <div className={styles.cardGrid} ref={starredGridRef}>
            {filteredStarred.map((card, idx) => (
              <div
                key={card.id}
                className={styles.cardItem}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={async () => {
                  if (card.type === 'Keyword Counter') {
                    const kw = KEYWORD_COUNTERS.find(k => k.keyword === card.name);
                    if (kw) handleSelectKeyword(kw);
                    return;
                  }
                  // Default starred cards need a Scryfall fetch to show detail
                  if (card.id.startsWith('default_') && (card.query || card.scryfallId)) {
                    try {
                      setMessage('Loading...');
                      let scryfallCard;
                      if (card.scryfallId) {
                        scryfallCard = await getCardById(card.scryfallId);
                      } else {
                        const result = await searchCards(card.query!);
                        scryfallCard = result.data[0];
                      }
                      if (scryfallCard) {
                        handleSelectCard(scryfallCard, card.faceIndex);
                      }
                      setMessage('');
                    } catch {
                      setMessage('Failed to load card');
                    }
                    return;
                  }
                  // Starred card with real Scryfall ID
                  try {
                    setMessage('Loading...');
                    const fullCard = await getCardById(card.id);
                    handleSelectCard(fullCard);
                    setMessage('');
                  } catch {
                    setMessage('Failed to load card');
                  }
                }}
              >
                {card.imageUri ? (
                  <img src={card.imageUri} alt={card.name} loading="lazy" />
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: '5/7', background: 'var(--bg-surface-hover)',
                    borderRadius: 'var(--radius-md)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 8,
                  }}>
                    {card.name}
                  </div>
                )}
                <div className={styles.cardItemName}>{card.name}</div>
                <button
                  className={styles.starBtn}
                  data-starred="true"
                  onClick={(e) => { e.stopPropagation(); unstar(card.id); }}
                >
                  ★
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Search results */}
      {showSearchResults && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>All {TYPE_FILTERS.find(f => f.label === activeFilter)?.display || 'Results'}</span>
          </div>
          {searchLoading && <div className={styles.loading}>Searching...</div>}
          <div className={styles.cardGrid}>
            {searchResults.map((card) => {
              const url = getImageUri(card, 'small');
              return (
                <div key={card.id} className={styles.cardItem} onClick={() => handleSelectCard(card)}>
                  {url && <img src={url} alt={card.name} loading="lazy" />}
                  <div className={styles.cardItemName}>{card.name}</div>
                  <button
                    className={styles.starBtn}
                    data-starred={isStarred(card.id)}
                    onClick={(e) => toggleStar(card, e)}
                  >
                    {isStarred(card.id) ? '★' : '☆'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recents (shown when not searching and not keyword mode) */}
      {!hasSearch && !isKeywordMode && recents.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Recent</span>
          </div>
          <div className={styles.recentRow}>
            {recents.map((card) => (
              <div
                key={card.id}
                className={styles.recentCard}
                onClick={async () => {
                  if (card.type === 'Keyword Counter') {
                    const kw = KEYWORD_COUNTERS.find(k => k.keyword === card.name);
                    if (kw) handleSelectKeyword(kw);
                    return;
                  }
                  // Fetch full card data by Scryfall ID
                  try {
                    setMessage('Loading...');
                    const fullCard = await getCardById(card.id);
                    handleSelectCard(fullCard);
                    setMessage('');
                  } catch {
                    setMessage('Failed to load card');
                  }
                }}
              >
                {card.imageUri ? (
                  <img src={card.imageUri} alt={card.name} loading="lazy" />
                ) : (
                  <div style={{
                    width: 90, height: 126, background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', padding: 4,
                  }}>
                    {card.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {message && <div className={styles.message}>{message}</div>}

      {/* Card detail bottom sheet */}
      {(selectedCard || selectedKeyword) && (
        <div className={styles.detailOverlay} onClick={closeDetail}>
          <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            <button className={styles.detailClose} onClick={closeDetail}>&times;</button>

            {selectedKeyword ? (
              <>
                <div className={styles.detailName}>{selectedKeyword.keyword}</div>
                <div className={styles.detailType}>Keyword Counter</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', lineHeight: 1.4 }}>
                  {selectedKeyword.reminderText}
                </p>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={includeReminder}
                    onChange={(e) => setIncludeReminder(e.target.checked)}
                    style={{ accentColor: 'var(--accent-blue)', width: 18, height: 18, cursor: 'pointer' }}
                  />
                  Include reminder text on print
                </label>
              </>
            ) : displayCard ? (
              <>
                {displayImageUrl && (
                  <img className={styles.detailImg} src={displayImageUrl} alt={displayCard.name} />
                )}
                <div className={styles.detailName}>{displayCard.name}</div>
                <div className={styles.detailType}>{displayCard.type_line}</div>

                {/* Printings dropdown (hidden for dungeons) */}
                {!displayCard?.type_line?.startsWith('Dungeon') && <div className={styles.printingsSection}>
                  {loadingPrintings ? (
                    <div className={styles.printingsLoading}>Loading printings…</div>
                  ) : printings.length > 1 ? (
                    <select
                      className={styles.printingsSelect}
                      value={activePrinting?.id ?? ''}
                      onChange={(e) => handleSelectPrinting(e.target.value)}
                    >
                      {printings.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.set_name} · #{p.collector_number} · {p.artist}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>}
              </>
            ) : null}

            <button
              className={styles.btnPrint}
              onClick={handlePrint}
              disabled={status !== 'ready'}
            >
              Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
