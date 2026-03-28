import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { usePrinter } from '../hooks/usePrinter.ts';
import { useSettings, useSettingsDispatch } from '../context/SettingsContext.tsx';
import { getRandomCard, searchCards, getImageUri, fetchCardArt, type ScryfallCard } from '../lib/scryfall.ts';
import { renderCardToCanvas } from '../lib/printer/thermalRenderer.ts';
import { FormatInfo } from '../components/FormatInfo.tsx';
import styles from './Archenemy.module.css';

/** 'idle' = card back, 'back' = showing card back during transition, 'ready' = card loaded */
type CardPhase = 'idle' | 'back' | 'ready';

const ARCHENEMY_SETS = [
  { label: 'All Sets', value: '' },
  { label: 'Archenemy Schemes (OARC)', value: 'set:oarc' },
  { label: 'Archenemy: Nicol Bolas Schemes (OE01)', value: 'set:oe01' },
  { label: 'Duskmourn Commander (DSC)', value: 'set:dsc' },
  { label: 'DCI Promos', value: 'set:dci' },
];

export function Archenemy() {
  const { status, print } = usePrinter();
  const settings = useSettings();
  const settingsDispatch = useSettingsDispatch();

  const [currentScheme, setCurrentScheme] = useState<ScryfallCard | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [allCards, setAllCards] = useState<ScryfallCard[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [message, setMessage] = useState('');
  const [loadingNext, setLoadingNext] = useState(false);
  const [phase, setPhase] = useState<CardPhase>('idle');
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [previewCard, setPreviewCard] = useState<ScryfallCard | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collapsedSets = settings.archenemyCollapsedSets;

  // Reset stale set filter
  const validValues = useMemo(() => new Set(ARCHENEMY_SETS.map(s => s.value)), []);
  useEffect(() => {
    if (settings.archenemySetFilter && !validValues.has(settings.archenemySetFilter)) {
      settingsDispatch({ type: 'SET', key: 'archenemySetFilter', value: '' });
    }
  }, [settings.archenemySetFilter, validValues, settingsDispatch]);

  const buildQuery = useCallback(() => {
    const base = 't:scheme';
    return settings.archenemySetFilter ? `${base} ${settings.archenemySetFilter}` : base;
  }, [settings.archenemySetFilter]);

  const nextScheme = useCallback(async () => {
    setLoadingNext(true);
    setMessage('');
    setPhase('back');
    try {
      const card = await getRandomCard(buildQuery());
      setCurrentScheme(card);
    } catch (e) {
      setPhase(currentScheme ? 'ready' : 'idle');
      setMessage(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoadingNext(false);
    }
  }, [buildQuery, currentScheme]);

  const fetchAllCards = useCallback(async () => {
    setLoadingAll(true);
    try {
      let allResults: ScryfallCard[] = [];
      let data = await searchCards(buildQuery());
      allResults = [...data.data];
      while (data.has_more && data.next_page) {
        await new Promise(r => setTimeout(r, 100));
        const resp = await fetch(data.next_page);
        data = await resp.json();
        allResults = [...allResults, ...data.data];
      }
      setAllCards(allResults);
      setShowAll(true);
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoadingAll(false);
    }
  }, [buildQuery]);

  const handleShowAll = useCallback(async () => {
    if (showAll) {
      setShowAll(false);
      setAllCards([]);
      return;
    }
    await fetchAllCards();
  }, [showAll, fetchAllCards]);

  // Re-fetch when set filter changes while showing all cards
  const prevFilterRef = useRef(settings.archenemySetFilter);
  useEffect(() => {
    if (prevFilterRef.current !== settings.archenemySetFilter) {
      prevFilterRef.current = settings.archenemySetFilter;
      if (showAll) {
        fetchAllCards();
      }
    }
  }, [settings.archenemySetFilter, showAll, fetchAllCards]);

  // Group cards by set for the Show All view
  const groupedCards = useMemo(() => {
    if (!showAll || allCards.length === 0) return [];
    const groups: Record<string, ScryfallCard[]> = {};
    for (const card of allCards) {
      const setName = card.set_name || 'Unknown';
      if (!groups[setName]) groups[setName] = [];
      groups[setName].push(card);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [showAll, allCards]);

  const selectCard = (card: ScryfallCard) => setSelectedCard(card);
  const closeDetail = () => setSelectedCard(null);

  const setScheme = (card: ScryfallCard) => {
    setPhase('back');
    setCurrentScheme(card);
    setSelectedCard(null);
    setShowAll(false);
    setAllCards([]);
  };

  const handlePrintCard = async (card: ScryfallCard) => {
    setMessage('Printing...');
    try {
      let artImg: ImageBitmap | null = null;
      if (settings.printArt) {
        const artUrl = getImageUri(card, 'art_crop');
        if (artUrl) {
          try { artImg = await fetchCardArt(artUrl); } catch { /* skip art */ }
        }
      }
      const canvas = renderCardToCanvas({
        name: card.name,
        typeLine: card.type_line,
        oracleText: card.oracle_text,
      }, artImg);
      await print(canvas);
      setMessage(`Printed: ${card.name}`);
    } catch (e) {
      setMessage(`Print failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handlePrint = async () => {
    if (!currentScheme) return;
    await handlePrintCard(currentScheme);
  };

  const imageUrl = currentScheme ? getImageUri(currentScheme) : null;
  const isAllSets = !settings.archenemySetFilter;

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.header}>Archenemy</h2>
        <FormatInfo
          title="Archenemy"
          description="One player is the Archenemy with a scheme deck, battling a team of opponents. At the start of each of their main phases, the Archenemy sets a scheme in motion by revealing the top card of their scheme deck."
          rulesUrl="https://magic.wizards.com/en/formats/archenemy"
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.btnNext} onClick={nextScheme} disabled={loadingNext}>
          {loadingNext ? 'Loading...' : 'Set Scheme in Motion'}
        </button>
        <button className={styles.btnPrint} onClick={handlePrint} disabled={!currentScheme || status !== 'ready'}>
          Print
        </button>
      </div>

      <div className={styles.settings}>
        <select
          className={styles.setFilter}
          value={settings.archenemySetFilter}
          onChange={(e) => settingsDispatch({ type: 'SET', key: 'archenemySetFilter', value: e.target.value })}
          aria-label="Filter by set"
        >
          {ARCHENEMY_SETS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={handleShowAll}
            disabled={loadingAll}
          />
          Show All Cards
        </label>
      </div>

      <div className={styles.cardArea}>
        {/* Card back layer */}
        <div className={styles.cardBack} data-visible={phase !== 'ready'}>
          <img
            src={`${import.meta.env.BASE_URL}card-back.jpg`}
            alt="Card back"
            className={styles.cardBackImg}
          />
        </div>

        {/* Card face layer */}
        {currentScheme && imageUrl && (
          <img
            className={styles.cardImg}
            data-layer="front"
            data-visible={phase === 'ready'}
            key={currentScheme.id}
            src={imageUrl}
            alt={currentScheme.name}
            onLoad={() => setPhase('ready')}
            onError={() => setPhase('ready')}
          />
        )}
      </div>

      {/* Card info */}
      {currentScheme && phase === 'ready' && (
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{currentScheme.name}</div>
          <div className={styles.cardType}>{currentScheme.type_line}</div>
        </div>
      )}

      {showAll && groupedCards.length > 0 && (
        <div className={styles.groupedGrid}>
          {isAllSets && (
            <div className={styles.collapseControls}>
              <button
                className={styles.collapseBtn}
                onClick={() => settingsDispatch({ type: 'SET', key: 'archenemyCollapsedSets', value: [] })}
              >
                Expand All
              </button>
              <button
                className={styles.collapseBtn}
                onClick={() => settingsDispatch({ type: 'SET', key: 'archenemyCollapsedSets', value: groupedCards.map(([name]) => name) })}
              >
                Collapse All
              </button>
            </div>
          )}
          {groupedCards.map(([setName, cards]) => {
            const isCollapsed = isAllSets && collapsedSets.includes(setName);
            return (
              <div key={setName} className={styles.setGroup}>
                {isAllSets && (
                  <button
                    className={styles.setGroupHeader}
                    onClick={() => {
                      const next = isCollapsed
                        ? collapsedSets.filter((s: string) => s !== setName)
                        : [...collapsedSets, setName];
                      settingsDispatch({ type: 'SET', key: 'archenemyCollapsedSets', value: next });
                    }}
                    aria-expanded={!isCollapsed}
                  >
                    <span className={styles.chevron} data-collapsed={isCollapsed}>▸</span>
                    {setName} ({cards.length})
                  </button>
                )}
                {!isCollapsed && (
                  <div className={styles.grid}>
                    {cards.map((card) => {
                      const url = getImageUri(card, 'small');
                      return url ? (
                        <div
                          key={card.id}
                          className={styles.gridCard}
                          onClick={() => selectCard(card)}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setPreviewPos({ x: rect.left + rect.width / 2, y: rect.top });
                            setPreviewCard(card);
                          }}
                          onMouseLeave={() => setPreviewCard(null)}
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            const rect = e.currentTarget.getBoundingClientRect();
                            longPressTimer.current = setTimeout(() => {
                              setPreviewPos({ x: rect.left + rect.width / 2, y: touch.clientY });
                              setPreviewCard(card);
                            }, 400);
                          }}
                          onTouchEnd={() => {
                            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                            if (previewCard) setPreviewCard(null);
                          }}
                          onTouchMove={() => {
                            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                          }}
                        >
                          <img src={url} alt={card.name} loading="lazy" />
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hover / long-press preview */}
      {previewCard && previewPos && (() => {
        const previewUrl = getImageUri(previewCard, 'normal');
        const previewH = 460;
        const showBelow = previewPos.y < previewH + 12;
        const top = showBelow ? previewPos.y + 60 : previewPos.y - previewH - 12;
        return previewUrl ? (
          <div className={styles.previewTooltip} style={{ top, left: previewPos.x }}>
            <img className={styles.previewImg} src={previewUrl} alt={previewCard.name} />
            <div className={styles.previewName}>{previewCard.name}</div>
          </div>
        ) : null;
      })()}

      {/* Card detail bottom sheet */}
      {selectedCard && (() => {
        const detailUrl = getImageUri(selectedCard, 'normal');
        return (
          <div className={styles.detailOverlay} onClick={closeDetail}>
            <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
              <button className={styles.detailClose} onClick={closeDetail} aria-label="Close">&times;</button>
              {detailUrl && (
                <img className={styles.detailImg} src={detailUrl} alt={selectedCard.name} />
              )}
              <div className={styles.detailName}>{selectedCard.name}</div>
              <div className={styles.detailType}>{selectedCard.type_line}</div>
              <div className={styles.detailActions}>
                <button className={styles.btnNext} onClick={() => setScheme(selectedCard)}>
                  Set This Scheme
                </button>
                <button className={styles.btnPrint} onClick={() => handlePrintCard(selectedCard)} disabled={status !== 'ready'}>
                  Print
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className={styles.message}>{message}</div>
    </div>
  );
}
