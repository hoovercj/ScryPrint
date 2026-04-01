import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { usePrinter } from '../hooks/usePrinter.ts';
import { useSettings, useSettingsDispatch } from '../context/SettingsContext.tsx';
import { useLocale } from '../hooks/useLocale.ts';
import { getRandomCard, searchCards, getImageUri, fetchCardArt, type ScryfallCard } from '../lib/scryfall.ts';
import { renderCardToCanvas } from '../lib/printer/thermalRenderer.ts';
import { FormatInfo } from '../components/FormatInfo.tsx';
import { useFormatDeck } from '../hooks/useFormatDeck.ts';
import styles from './Archenemy.module.css';

/** 'idle' = card back, 'back' = showing card back during transition, 'ready' = card loaded */
type CardPhase = 'idle' | 'back' | 'ready';
type Tab = 'play' | 'build';

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
  const { t } = useLocale();

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('play');

  // Deck builder + play-through
  const deck = useFormatDeck({
    storageKey: 'scryprint_archenemy_deck',
    maxCopies: 2,
    minDeckSize: 20,
  });

  // Random play state
  const [currentScheme, setCurrentScheme] = useState<ScryfallCard | null>(null);
  const [message, setMessage] = useState('');
  const [loadingNext, setLoadingNext] = useState(false);
  const [phase, setPhase] = useState<CardPhase>('idle');

  // Language toggle: default to user's language, with option to show all English cards
  const [showEnglish, setShowEnglish] = useState(false);
  const effectiveLang = (settings.language !== 'en' && !showEnglish) ? settings.language : undefined;

  // Shared card browsing
  const [allCards, setAllCards] = useState<ScryfallCard[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Detail / preview
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [previewCard, setPreviewCard] = useState<ScryfallCard | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Played cards expand
  const [showPlayed, setShowPlayed] = useState(false);

  // Invalid deck dialog
  const [showInvalidDialog, setShowInvalidDialog] = useState(false);

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

  // === Card fetching ===
  const fetchAllCards = useCallback(async () => {
    setLoadingAll(true);
    try {
      let allResults: ScryfallCard[] = [];
      let data = await searchCards(buildQuery(), undefined, { lang: effectiveLang });
      allResults = [...data.data];
      while (data.has_more && data.next_page) {
        await new Promise(r => setTimeout(r, 100));
        const resp = await fetch(data.next_page);
        data = await resp.json();
        allResults = [...allResults, ...data.data];
      }
      setAllCards(allResults);
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoadingAll(false);
    }
  }, [buildQuery, effectiveLang]);

  // Auto-load cards when Build tab is opened
  useEffect(() => {
    if (activeTab === 'build' && allCards.length === 0 && !loadingAll) {
      fetchAllCards();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShowAll = useCallback(async () => {
    if (showAll) {
      setShowAll(false);
      return;
    }
    if (allCards.length === 0) await fetchAllCards();
    setShowAll(true);
  }, [showAll, allCards.length, fetchAllCards]);

  // Re-fetch when set filter changes
  const prevFilterRef = useRef(settings.archenemySetFilter);
  useEffect(() => {
    if (prevFilterRef.current !== settings.archenemySetFilter) {
      prevFilterRef.current = settings.archenemySetFilter;
      if (activeTab === 'build' || showAll) {
        fetchAllCards();
      }
    }
  }, [settings.archenemySetFilter, activeTab, showAll, fetchAllCards]);

  // Re-fetch when language toggle changes
  const prevLangRef = useRef(effectiveLang);
  useEffect(() => {
    if (prevLangRef.current !== effectiveLang) {
      prevLangRef.current = effectiveLang;
      if (allCards.length > 0 || activeTab === 'build' || showAll) {
        fetchAllCards();
      }
    }
  }, [effectiveLang, allCards.length, activeTab, showAll, fetchAllCards]);

  // Group cards by set
  const groupedCards = useMemo(() => {
    if (allCards.length === 0) return [];
    const groups: Record<string, ScryfallCard[]> = {};
    for (const card of allCards) {
      const setName = card.set_name || 'Unknown';
      if (!groups[setName]) groups[setName] = [];
      groups[setName].push(card);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [allCards]);

  // === Random play ===
  const nextScheme = useCallback(async () => {
    setLoadingNext(true);
    setMessage('');
    setPhase('back');
    try {
      const card = await getRandomCard(buildQuery(), effectiveLang);
      setCurrentScheme(card);
    } catch (e) {
      setPhase(currentScheme ? 'ready' : 'idle');
      setMessage(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoadingNext(false);
    }
  }, [buildQuery, currentScheme, effectiveLang]);

  // === Deck play ===
  const handleDeckDraw = useCallback(() => {
    if (deck.isExhausted) return;
    setPhase('back');
    deck.drawNext();
  }, [deck]);

  const handleStartDeck = useCallback(() => {
    setPhase('back');
    deck.shuffleAndStart(true);
  }, [deck]);

  const handleReshuffle = useCallback(() => {
    setPhase('back');
    deck.reshuffle();
  }, [deck]);

  const handleEndGame = useCallback(() => {
    deck.endGame();
    setPhase('idle');
    setCurrentScheme(null);
  }, [deck]);

  // Display card depends on mode
  const displayCard = deck.isPlaying ? deck.currentCard : currentScheme;
  const imageUrl = displayCard ? getImageUri(displayCard) : null;
  const isAllSets = !settings.archenemySetFilter;

  // === Print ===
  const handlePrintCard = async (card: ScryfallCard) => {
    setMessage(t('archenemy.printing'));
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
    if (!displayCard) return;
    await handlePrintCard(displayCard);
  };

  // Auto-print when displayCard changes
  useEffect(() => {
    if (!displayCard || !settings.autoPrint || status !== 'ready') return;
    handlePrintCard(displayCard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayCard]);

  // === Detail panel ===
  const selectCard = (card: ScryfallCard) => setSelectedCard(card);
  const closeDetail = () => setSelectedCard(null);

  const setSchemeFromDetail = (card: ScryfallCard) => {
    setPhase('back');
    setCurrentScheme(card);
    setSelectedCard(null);
    setShowAll(false);
  };

  // === Collapse helpers ===
  const toggleCollapse = (setName: string) => {
    const isCollapsed = collapsedSets.includes(setName);
    const next = isCollapsed
      ? collapsedSets.filter((s: string) => s !== setName)
      : [...collapsedSets, setName];
    settingsDispatch({ type: 'SET', key: 'archenemyCollapsedSets', value: next });
  };

  // Build for me: random legal deck (20 cards, max 2 copies each)
  const buildForMe = useCallback(() => {
    if (allCards.length === 0) return;
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    const entries: { card: typeof shuffled[0]; qty: number }[] = [];
    let total = 0;
    for (const card of shuffled) {
      if (total >= 20) break;
      const existing = entries.find(e => e.card.name === card.name);
      if (existing) {
        if (existing.qty < 2) { existing.qty++; total++; }
      } else {
        entries.push({ card, qty: 1 }); total++;
      }
    }
    // If we still need more and can add second copies
    if (total < 20) {
      for (const e of entries) {
        if (total >= 20) break;
        if (e.qty < 2) { e.qty++; total++; }
      }
    }
    deck.addAll(entries.flatMap(e => Array(e.qty).fill(null).map(() => e.card)));
  }, [allCards, deck]);

  // Card grid rendering (shared between play/show-all and build tabs)
  const renderCardGrid = (cards: ScryfallCard[], isBuildMode: boolean) => (
    <div className={isBuildMode ? styles.buildGrid : styles.grid}>
      {cards.map((card) => {
        const url = getImageUri(card, 'small');
        const qty = deck.getQty(card.id);
        if (!url) return null;
        return (
          <div
            key={card.id}
            className={isBuildMode ? styles.buildCard : styles.gridCard}
            data-in-deck={isBuildMode ? qty > 0 : undefined}
            onClick={() => !isBuildMode && selectCard(card)}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPreviewPos({ x: rect.left + rect.width / 2, y: rect.top });
              setPreviewCard(card);
            }}
            onMouseLeave={() => setPreviewCard(null)}
            onTouchStart={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              longPressTimer.current = setTimeout(() => {
                setPreviewPos({ x: rect.left + rect.width / 2, y: rect.top });
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
            <img
              src={url}
              alt={card.name}
              loading="lazy"
              onClick={isBuildMode ? () => selectCard(card) : undefined}
            />
            {isBuildMode && (
              <div className={styles.deckControls}>
                {qty > 0 && (
                  <button
                    className={styles.deckBtnMinus}
                    onClick={(e) => { e.stopPropagation(); deck.removeCard(card.id); }}
                    aria-label="Remove from deck"
                  >−</button>
                )}
                <span className={styles.deckQty} data-active={qty > 0}>{qty}</span>
                <button
                  className={styles.deckBtnPlus}
                  onClick={(e) => { e.stopPropagation(); deck.addCard(card); }}
                  disabled={qty >= deck.maxCopies}
                  aria-label="Add to deck"
                >+</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Grouped grid rendering
  const renderGroupedGrid = (isBuildMode: boolean) => (
    <div className={styles.groupedGrid}>
      {isAllSets && (
        <div className={styles.collapseControls}>
          <button className={styles.collapseBtn} onClick={() => settingsDispatch({ type: 'SET', key: 'archenemyCollapsedSets', value: [] })}>
            {t('archenemy.expandAll')}
          </button>
          <button className={styles.collapseBtn} onClick={() => settingsDispatch({ type: 'SET', key: 'archenemyCollapsedSets', value: groupedCards.map(([name]) => name) })}>
            {t('archenemy.collapseAll')}
          </button>
        </div>
      )}
      {groupedCards.map(([setName, cards]) => {
        const isCollapsed = isAllSets && collapsedSets.includes(setName);
        return (
          <div key={setName} className={styles.setGroup}>
            {isAllSets && (
              <button className={styles.setGroupHeader} onClick={() => toggleCollapse(setName)} aria-expanded={!isCollapsed}>
                <span className={styles.chevron} data-collapsed={isCollapsed}>▸</span>
                {setName} ({cards.length})
              </button>
            )}
            {!isCollapsed && renderCardGrid(cards, isBuildMode)}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.header}>{t('archenemy.title')}</h2>
        <FormatInfo
          title="Archenemy"
          description="One player is the Archenemy with a scheme deck (20+ cards, max 2 copies each), battling a team of opponents. At the start of each main phase, the Archenemy sets a scheme in motion by revealing the top card."
          rulesUrl="https://magic.wizards.com/en/formats/archenemy"
        />
      </div>

      {settings.language !== 'en' && (
        <button
          className={styles.langToggle}
          onClick={() => setShowEnglish(!showEnglish)}
        >
          {showEnglish ? t('common.showingEnglish') : t('common.showAllEnglishSchemes')}
        </button>
      )}

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'play' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('play')}
        >
          {t('archenemy.play')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'build' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('build')}
        >
          {t('archenemy.deck')}{deck.deckSize > 0 ? ` (${deck.deckSize})` : ''}
        </button>
      </div>

      {/* ====== PLAY TAB ====== */}
      {activeTab === 'play' && (
        <>
          {deck.isPlaying ? (
            /* --- Deck Play Mode --- */
            <>
              <div className={styles.deckProgress}>
                <span className={styles.deckProgressCount}>{deck.drawIndex} / {deck.deckSize}</span> {t('archenemy.drawn')}
              </div>

              <div className={styles.actions}>
                <button className={styles.btnNext} onClick={handleDeckDraw} disabled={deck.isExhausted}>
                  {deck.isExhausted ? t('archenemy.deckEmpty') : t('archenemy.setScheme')}
                </button>
                <button className={styles.btnPrint} onClick={handlePrint} disabled={!displayCard || status !== 'ready'}>
                  {t('archenemy.print')}
                </button>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={settings.autoPrint} onChange={(e) => settingsDispatch({ type: 'SET', key: 'autoPrint', value: e.target.checked })} />
                  {t('archenemy.autoprint')}
                </label>
              </div>

              <div className={styles.cardArea}>
                <div className={styles.cardBack} data-visible={phase !== 'ready'}>
                  <img src={`${import.meta.env.BASE_URL}card-back.jpg`} alt="Card back" className={styles.cardBackImg} />
                </div>
                {displayCard && imageUrl && (
                  <img
                    className={styles.cardImg}
                    data-layer="front"
                    data-visible={phase === 'ready'}
                    key={`${displayCard.id}-${deck.drawIndex}`}
                    src={imageUrl}
                    alt={displayCard.name}
                    onLoad={() => setPhase('ready')}
                    onError={() => setPhase('ready')}
                  />
                )}
              </div>

              {displayCard && phase === 'ready' && (
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>{displayCard.name}</div>
                  <div className={styles.cardType}>{displayCard.type_line}</div>
                </div>
              )}

              {deck.isExhausted && (
                <div className={styles.deckExhausted}>
                  {t('archenemy.exhausted')}
                </div>
              )}

              <div className={styles.deckActions}>
                <button className={styles.btnSmall} onClick={handleReshuffle}>{t('archenemy.reshuffle')}</button>
                <button className={styles.btnSmall} onClick={handleEndGame}>{t('archenemy.endGame')}</button>
              </div>

              {/* Played cards */}
              {deck.played.length > 0 && (
                <div className={styles.playedSection}>
                  <button className={styles.playedToggle} onClick={() => setShowPlayed(!showPlayed)}>
                    <span className={styles.chevron} data-collapsed={!showPlayed}>▸</span>
                    {t('archenemy.played')} ({deck.played.length})
                  </button>
                  {showPlayed && (
                    <div className={styles.playedGrid}>
                      {deck.played.map((card, i) => {
                        const url = getImageUri(card, 'small');
                        return url ? (
                          <div key={`${card.id}-${i}`} className={styles.playedCard} onClick={() => selectCard(card)}>
                            <img src={url} alt={card.name} loading="lazy" />
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* --- Random / Starter Mode --- */
            <>
              <div className={styles.actions}>
                <button className={styles.btnNext} onClick={nextScheme} disabled={loadingNext}>
                  {loadingNext ? t('archenemy.loading') : t('archenemy.setScheme')}
                </button>
                <button className={styles.btnPrint} onClick={handlePrint} disabled={!displayCard || status !== 'ready'}>
                  {t('archenemy.print')}
                </button>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={settings.autoPrint} onChange={(e) => settingsDispatch({ type: 'SET', key: 'autoPrint', value: e.target.checked })} />
                  {t('archenemy.autoprint')}
                </label>
              </div>

              <div className={styles.settings}>
                <select
                  className={styles.setFilter}
                  value={settings.archenemySetFilter}
                  onChange={(e) => settingsDispatch({ type: 'SET', key: 'archenemySetFilter', value: e.target.value })}
                  aria-label="Filter by set"
                >
                  {ARCHENEMY_SETS.map((s) => (
                    <option key={s.value} value={s.value}>{s.value === '' ? t('archenemy.allSets') : s.label}</option>
                  ))}
                </select>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={showAll} onChange={handleShowAll} disabled={loadingAll} />
                  {t('archenemy.showAll')}
                </label>
              </div>

              <div className={styles.cardArea}>
                <div className={styles.cardBack} data-visible={phase !== 'ready'}>
                  <img src={`${import.meta.env.BASE_URL}card-back.jpg`} alt="Card back" className={styles.cardBackImg} />
                </div>
                {displayCard && imageUrl && (
                  <img
                    className={styles.cardImg}
                    data-layer="front"
                    data-visible={phase === 'ready'}
                    key={displayCard.id}
                    src={imageUrl}
                    alt={displayCard.name}
                    onLoad={() => setPhase('ready')}
                    onError={() => setPhase('ready')}
                  />
                )}
              </div>

              {displayCard && phase === 'ready' && (
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>{displayCard.name}</div>
                  <div className={styles.cardType}>{displayCard.type_line}</div>
                </div>
              )}

              {/* Play from deck CTA */}
              {deck.hasDeck && (
                <button
                  className={styles.btnDeckPlay}
                  onClick={() => deck.isLegal ? handleStartDeck() : setShowInvalidDialog(true)}
                >
                  ▶ Play My Deck ({deck.deckSize} schemes)
                  {!deck.isLegal && <span className={styles.deckWarning}> — need {deck.minDeckSize} minimum</span>}
                </button>
              )}

              {/* Show All grid */}
              {showAll && groupedCards.length > 0 && renderGroupedGrid(false)}
            </>
          )}
        </>
      )}

      {/* ====== BUILD TAB ====== */}
      {activeTab === 'build' && (
        <>
          <div className={styles.deckSummary}>
            <span className={deck.isLegal ? styles.deckCountLegal : styles.deckCountIllegal}>
              {deck.deckSize} / {deck.minDeckSize} minimum
            </span>
            <span className={styles.deckRule}>Max {deck.maxCopies} copies each</span>
          </div>

          <div className={styles.settings}>
            <select
              className={styles.setFilter}
              value={settings.archenemySetFilter}
              onChange={(e) => settingsDispatch({ type: 'SET', key: 'archenemySetFilter', value: e.target.value })}
              aria-label="Filter by set"
            >
              {ARCHENEMY_SETS.map((s) => (
                <option key={s.value} value={s.value}>{s.value === '' ? t('archenemy.allSets') : s.label}</option>
              ))}
            </select>
            <div className={styles.deckQuickActions}>
              <button className={styles.linkBtn} onClick={buildForMe} disabled={allCards.length === 0}>
                {t('archenemy.buildForMe')}
              </button>
              <button className={styles.linkBtn} onClick={() => deck.addAll(allCards)} disabled={allCards.length === 0}>
                {t('archenemy.addAll')}
              </button>
              <button className={styles.linkBtn} onClick={deck.clearDeck} disabled={deck.deckSize === 0}>
                {t('archenemy.clear')}
              </button>
            </div>
          </div>

          {loadingAll && <div className={styles.message}>{t('archenemy.loadingCards')}</div>}

          {groupedCards.length > 0 && renderGroupedGrid(true)}
        </>
      )}

      {/* Hover / long-press preview */}
      {previewCard && previewPos && (() => {
        const previewUrl = getImageUri(previewCard, 'normal');
        const previewH = 460;
        // Always show above the card; only fall below if no room at top
        const top = previewPos.y > previewH + 12
          ? previewPos.y - previewH - 12
          : previewPos.y + 180;
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
        const qty = deck.getQty(selectedCard.id);
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
                {!deck.isPlaying && (
                  <button className={styles.btnNext} onClick={() => setSchemeFromDetail(selectedCard)}>
                    {t('archenemy.setThis')}
                  </button>
                )}
                <button className={styles.btnPrint} onClick={() => handlePrintCard(selectedCard)} disabled={status !== 'ready'}>
                  {t('archenemy.print')}
                </button>
              </div>
              <div className={styles.detailDeckRow}>
                <button
                  className={styles.deckBtnMinus}
                  onClick={() => deck.removeCard(selectedCard.id)}
                  disabled={qty === 0}
                  aria-label="Remove from deck"
                >−</button>
                <span className={styles.detailDeckQty}>{qty} in deck</span>
                <button
                  className={styles.deckBtnPlus}
                  onClick={() => deck.addCard(selectedCard)}
                  disabled={qty >= deck.maxCopies}
                  aria-label="Add to deck"
                >+</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invalid deck dialog */}
      {showInvalidDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowInvalidDialog(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <button className={styles.dialogClose} onClick={() => setShowInvalidDialog(false)} aria-label="Close">&times;</button>
            <div className={styles.dialogTitle}>{t('archenemy.invalidDeck')}</div>
            <div className={styles.dialogBody}>
              {!deck.isLegal && <p>Need at least {deck.minDeckSize} cards (currently {deck.deckSize}).</p>}
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.btnNext} onClick={() => { setShowInvalidDialog(false); handleStartDeck(); }}>
                {t('archenemy.playAnyway')}
              </button>
              <button className={styles.btnSmall} onClick={() => { setShowInvalidDialog(false); setActiveTab('build'); }}>
                {t('archenemy.editDeck')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.message}>{message}</div>
    </div>
  );
}
