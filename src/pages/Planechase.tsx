import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { usePrinter } from '../hooks/usePrinter.ts';
import { useSettings, useSettingsDispatch } from '../context/SettingsContext.tsx';
import { useLocale } from '../hooks/useLocale.ts';
import { getRandomCard, searchCards, getImageUri, fetchCardArt, type ScryfallCard } from '../lib/scryfall.ts';
import { renderCardToCanvas } from '../lib/printer/thermalRenderer.ts';
import { FormatInfo } from '../components/FormatInfo.tsx';
import { useFormatDeck } from '../hooks/useFormatDeck.ts';
import styles from './Planechase.module.css';

type DieResult = 'planeswalk' | 'chaos' | 'blank' | null;

/** 'idle' = card back, 'back' = showing card back during transition, 'ready' = card loaded */
type CardPhase = 'idle' | 'back' | 'ready';
type Tab = 'play' | 'build';

const DIE_FACES: DieResult[] = ['planeswalk', 'chaos', 'blank', 'blank', 'blank', 'blank'];

const PLANECHASE_SETS = [
  { label: 'All Sets', value: '' },
  { label: 'Planechase Anthology Planes (OPCA)', value: 'set:opca' },
  { label: 'Black Lotus Unknown Planechase (PUNK)', value: 'set:punk' },
  { label: 'Secret Lair Showcase Planes (PSSC)', value: 'set:pssc' },
  { label: 'March of the Machine Commander (MOC)', value: 'set:moc' },
  { label: 'Doctor Who Commander (WHO)', value: 'set:who' },
];

function DieIcon({ result }: { result: DieResult | 'idle' }) {
  if (result === 'planeswalk') return <i className="ms ms-planeswalker ms-2x" />;
  if (result === 'chaos') return <i className="ms ms-chaos ms-2x" />;
  if (result === 'idle') return <i className="ms ms-planeswalker ms-2x" style={{ opacity: 0.3 }} />;
  return null;
}

export function Planechase() {
  const { status, print } = usePrinter();
  const settings = useSettings();
  const settingsDispatch = useSettingsDispatch();
  const { t } = useLocale();

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('play');

  // Player count drives shared-deck rules:
  //   min deck = min(40, 10 × players),  max phenomena = 2 × players
  const players = settings.planechasePlayers;
  const minDeckSize = Math.min(40, 10 * players);
  const maxPhenomena = 2 * players;

  // Deck builder + play-through (singleton)
  const deck = useFormatDeck({
    storageKey: 'scryprint_planechase_deck',
    maxCopies: 1,
    minDeckSize,
  });

  // Count phenomena in deck for validation
  const phenomenaInDeck = useMemo(
    () => deck.entries.filter(e => e.card.type_line?.includes('Phenomenon')).reduce((s, e) => s + e.qty, 0),
    [deck.entries],
  );
  const phenomenaLegal = phenomenaInDeck <= maxPhenomena;

  // Random play state
  const [currentPlane, setCurrentPlane] = useState<ScryfallCard | null>(null);
  const [dieResult, setDieResult] = useState<DieResult>(null);
  const [rolling, setRolling] = useState(false);
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

  const collapsedSets = settings.planechaseCollapsedSets;

  // Reset stale set filter
  const validValues = useMemo(() => new Set(PLANECHASE_SETS.map(s => s.value)), []);
  useEffect(() => {
    if (settings.planechaseSetFilter && !validValues.has(settings.planechaseSetFilter)) {
      settingsDispatch({ type: 'SET', key: 'planechaseSetFilter', value: '' });
    }
  }, [settings.planechaseSetFilter, validValues, settingsDispatch]);

  const buildQuery = useCallback(() => {
    const base = '(t:plane OR t:phenomenon)';
    return settings.planechaseSetFilter ? `${base} ${settings.planechaseSetFilter}` : base;
  }, [settings.planechaseSetFilter]);

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

  // Auto-load when Build tab opens
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

  // Re-fetch on filter change
  const prevFilterRef = useRef(settings.planechaseSetFilter);
  useEffect(() => {
    if (prevFilterRef.current !== settings.planechaseSetFilter) {
      prevFilterRef.current = settings.planechaseSetFilter;
      if (activeTab === 'build' || showAll) {
        fetchAllCards();
      }
    }
  }, [settings.planechaseSetFilter, activeTab, showAll, fetchAllCards]);

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
  const nextPlane = useCallback(async () => {
    setLoadingNext(true);
    setMessage('');
    setPhase('back');
    try {
      const card = await getRandomCard(buildQuery(), effectiveLang);
      setCurrentPlane(card);
      setDieResult(null);
    } catch (e) {
      setPhase(currentPlane ? 'ready' : 'idle');
      setMessage(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoadingNext(false);
    }
  }, [buildQuery, currentPlane, effectiveLang]);

  const rollDie = useCallback(() => {
    setRolling(true);
    setDieResult(null);
    setTimeout(() => {
      const result = DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)];
      setDieResult(result);
      setRolling(false);
    }, 600);
  }, []);

  // === Deck play ===
  const handleDeckDraw = useCallback(() => {
    if (deck.isExhausted) return;
    setPhase('back');
    setDieResult(null);
    deck.drawNext();
  }, [deck]);

  const handleStartDeck = useCallback(() => {
    setPhase('back');
    setDieResult(null);
    deck.shuffleAndStart(true);
  }, [deck]);

  const handleReshuffle = useCallback(() => {
    setPhase('back');
    setDieResult(null);
    deck.reshuffle();
  }, [deck]);

  const handleEndGame = useCallback(() => {
    deck.endGame();
    setPhase('idle');
    setCurrentPlane(null);
    setDieResult(null);
  }, [deck]);

  // Display card depends on mode
  const displayCard = deck.isPlaying ? deck.currentCard : currentPlane;
  const imageUrl = displayCard ? getImageUri(displayCard) : null;
  const isLandscapeCard = displayCard?.layout === 'planar';
  const isAllSets = !settings.planechaseSetFilter;

  // === Print ===
  const handlePrintCard = async (card: ScryfallCard) => {
    setMessage(t('planechase.printing'));
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

  // === Detail / selection ===
  const selectCard = (card: ScryfallCard) => setSelectedCard(card);
  const closeDetail = () => setSelectedCard(null);

  const planeswalkTo = (card: ScryfallCard) => {
    setPhase('back');
    setCurrentPlane(card);
    setSelectedCard(null);
    setShowAll(false);
  };

  // Collapse helpers
  const toggleCollapse = (setName: string) => {
    const isCollapsed = collapsedSets.includes(setName);
    const next = isCollapsed
      ? collapsedSets.filter((s: string) => s !== setName)
      : [...collapsedSets, setName];
    settingsDispatch({ type: 'SET', key: 'planechaseCollapsedSets', value: next });
  };

  // Can add to deck? (singleton + phenomena limit)
  const canAddToDeck = useCallback((card: ScryfallCard): boolean => {
    if (deck.getQty(card.id) >= 1) return false; // singleton
    if (card.type_line?.includes('Phenomenon') && phenomenaInDeck >= maxPhenomena) return false;
    return true;
  }, [deck, phenomenaInDeck, maxPhenomena]);

  // Build for me: random legal deck
  const buildForMe = useCallback(() => {
    if (allCards.length === 0) return;
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    const phenomena: ScryfallCard[] = [];
    const planes: ScryfallCard[] = [];
    for (const c of shuffled) {
      if (c.type_line?.includes('Phenomenon')) {
        if (phenomena.length < maxPhenomena) phenomena.push(c);
      } else {
        planes.push(c);
      }
    }
    // Fill deck to minDeckSize: use planes first, then phenomena
    const picked: ScryfallCard[] = [];
    let pIdx = 0;
    let phIdx = 0;
    while (picked.length < minDeckSize && (pIdx < planes.length || phIdx < phenomena.length)) {
      if (pIdx < planes.length) { picked.push(planes[pIdx++]); }
      else if (phIdx < phenomena.length) { picked.push(phenomena[phIdx++]); }
    }
    // Sprinkle in remaining phenomena (up to cap) if deck isn't full yet
    while (phIdx < phenomena.length && picked.length < minDeckSize) {
      picked.push(phenomena[phIdx++]);
    }
    deck.addAll(picked);
  }, [allCards, minDeckSize, maxPhenomena, deck]);

  // Card grid rendering
  const renderCardGrid = (cards: ScryfallCard[], isBuildMode: boolean) => (
    <div className={isBuildMode ? styles.buildGrid : styles.grid}>
      {cards.map((card) => {
        const url = getImageUri(card, 'small');
        const isLandscape = card.layout === 'planar';
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
              className={isLandscape ? styles.gridImgRotated : undefined}
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
                <span className={styles.deckQty} data-active={qty > 0}>{qty > 0 ? '✓' : ''}</span>
                {qty === 0 && (
                  <button
                    className={styles.deckBtnPlus}
                    onClick={(e) => { e.stopPropagation(); deck.addCard(card); }}
                    disabled={!canAddToDeck(card)}
                    aria-label="Add to deck"
                  >+</button>
                )}
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
          <button className={styles.collapseBtn} onClick={() => settingsDispatch({ type: 'SET', key: 'planechaseCollapsedSets', value: [] })}>
            {t('planechase.expandAll')}
          </button>
          <button className={styles.collapseBtn} onClick={() => settingsDispatch({ type: 'SET', key: 'planechaseCollapsedSets', value: groupedCards.map(([name]) => name) })}>
            {t('planechase.collapseAll')}
          </button>
        </div>
      )}
      {groupedCards.map(([setName, cards]) => {
        const isCollapsed = isAllSets && collapsedSets.includes(setName);
        return (
          <div key={setName} className={styles.setGroup}>
            {isAllSets && (
              <button className={styles.setGroupHeader} onClick={() => toggleCollapse(setName)}>
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
        <h2 className={styles.header}>{t('planechase.title')}</h2>
        <FormatInfo
          title="Planechase"
          description="Build a shared planar deck (singleton). Min deck size and max phenomena scale with player count. Roll the planar die each turn — planeswalk to a new plane or trigger its chaos ability."
          rulesUrl="https://magic.wizards.com/en/formats/planechase"
        />
      </div>

      {settings.language !== 'en' && (
        <button
          className={styles.langToggle}
          onClick={() => setShowEnglish(!showEnglish)}
        >
          {showEnglish ? t('common.showingEnglish') : t('common.showAllEnglishPlanes')}
        </button>
      )}

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'play' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('play')}
        >
          {t('planechase.play')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'build' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('build')}
        >
          {t('planechase.deck')}{deck.deckSize > 0 ? ` (${deck.deckSize})` : ''}
        </button>
      </div>

      {/* ====== PLAY TAB ====== */}
      {activeTab === 'play' && (
        <>
          {/* Planar Die — always available */}
          <div className={styles.dieArea}>
            <button className={styles.die} data-rolling={rolling} onClick={rollDie} disabled={rolling}>
              {rolling ? '?' : <DieIcon result={dieResult ?? 'idle'} />}
            </button>
            <div className={styles.dieResult} data-result={dieResult || (rolling ? '' : 'idle')}>
              {dieResult === 'planeswalk' && <><i className="ms ms-planeswalker" /> {t('planechase.planeswalk')}!</>}
              {dieResult === 'chaos' && <><i className="ms ms-chaos" /> Chaos!</>}
              {dieResult === 'blank' && 'Nothing happens'}
              {!dieResult && !rolling && 'Roll the planar die\u2026'}
            </div>
          </div>

          {deck.isPlaying ? (
            /* --- Deck Play Mode --- */
            <>
              <div className={styles.deckProgress}>
                <span className={styles.deckProgressCount}>{deck.drawIndex} / {deck.deckSize}</span> {t('planechase.drawn')}
              </div>

              <div className={styles.actions}>
                <button className={styles.btnNext} onClick={handleDeckDraw} disabled={deck.isExhausted}>
                  {deck.isExhausted ? t('planechase.deckEmpty') : t('planechase.planeswalk')}
                </button>
                <button className={styles.btnPrint} onClick={handlePrint} disabled={!displayCard || status !== 'ready'}>
                  {t('planechase.print')}
                </button>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={settings.autoPrint} onChange={(e) => settingsDispatch({ type: 'SET', key: 'autoPrint', value: e.target.checked })} />
                  {t('planechase.autoprint')}
                </label>
              </div>

              <div className={styles.cardArea}>
                <div className={styles.cardBack} data-visible={phase !== 'ready'}>
                  <img src={`${import.meta.env.BASE_URL}planechase-back.jpg`} alt="Planechase card back" className={styles.cardBackImg} />
                </div>
                {displayCard && imageUrl && (
                  <img
                    className={isLandscapeCard ? styles.cardImgRotated : styles.cardImg}
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
                  You've visited every plane!
                </div>
              )}

              <div className={styles.deckActions}>
                <button className={styles.btnSmall} onClick={handleReshuffle}>{t('planechase.reshuffle')}</button>
                <button className={styles.btnSmall} onClick={handleEndGame}>{t('planechase.endGame')}</button>
              </div>

              {/* Played cards */}
              {deck.played.length > 0 && (
                <div className={styles.playedSection}>
                  <button className={styles.playedToggle} onClick={() => setShowPlayed(!showPlayed)}>
                    <span className={styles.chevron} data-collapsed={!showPlayed}>▸</span>
                    {t('planechase.played')} ({deck.played.length})
                  </button>
                  {showPlayed && (
                    <div className={styles.playedGrid}>
                      {deck.played.map((card, i) => {
                        const url = getImageUri(card, 'small');
                        const isLandscape = card.layout === 'planar';
                        return url ? (
                          <div key={`${card.id}-${i}`} className={styles.playedCard} onClick={() => selectCard(card)}>
                            <img src={url} alt={card.name} loading="lazy" className={isLandscape ? styles.gridImgRotated : undefined} />
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* --- Random Mode --- */
            <>
              <div className={styles.actions}>
                <button className={styles.btnNext} onClick={nextPlane} disabled={loadingNext}>
                  {loadingNext ? t('planechase.loading') : t('planechase.planeswalk')}
                </button>
                <button className={styles.btnPrint} onClick={handlePrint} disabled={!displayCard || status !== 'ready'}>
                  {t('planechase.print')}
                </button>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={settings.autoPrint} onChange={(e) => settingsDispatch({ type: 'SET', key: 'autoPrint', value: e.target.checked })} />
                  {t('planechase.autoprint')}
                </label>
              </div>

              <div className={styles.settings}>
                <select
                  className={styles.setFilter}
                  value={settings.planechaseSetFilter}
                  onChange={(e) => settingsDispatch({ type: 'SET', key: 'planechaseSetFilter', value: e.target.value })}
                >
                  {PLANECHASE_SETS.map((s) => (
                    <option key={s.value} value={s.value}>{s.value === '' ? t('planechase.allSets') : s.label}</option>
                  ))}
                </select>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={showAll} onChange={handleShowAll} disabled={loadingAll} />
                  {t('planechase.showAll')}
                </label>
              </div>

              <div className={styles.cardArea}>
                <div className={styles.cardBack} data-visible={phase !== 'ready'}>
                  <img src={`${import.meta.env.BASE_URL}planechase-back.jpg`} alt="Planechase card back" className={styles.cardBackImg} />
                </div>
                {displayCard && imageUrl && (
                  <img
                    className={isLandscapeCard ? styles.cardImgRotated : styles.cardImg}
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
                  onClick={() => (deck.isLegal && phenomenaLegal) ? handleStartDeck() : setShowInvalidDialog(true)}
                >
                  ▶ Play My Deck ({deck.deckSize} planes)
                  {!deck.isLegal && <span className={styles.deckWarning}> — need {minDeckSize} minimum</span>}
                  {deck.isLegal && !phenomenaLegal && <span className={styles.deckWarning}> — too many phenomena</span>}
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
            <span className={(deck.isLegal && phenomenaLegal) ? styles.deckCountLegal : styles.deckCountIllegal}>
              {deck.deckSize} / {minDeckSize} minimum
            </span>
            <span className={phenomenaLegal ? styles.deckRule : styles.deckRuleIllegal}>
              Singleton · {phenomenaInDeck}/{maxPhenomena} phenomena{!phenomenaLegal ? ' ⚠' : ''}
            </span>
          </div>

          <div className={styles.settings}>
            <label className={styles.playerLabel}>
              Players
              <select
                className={styles.playerSelect}
                value={players}
                onChange={(e) => settingsDispatch({ type: 'SET', key: 'planechasePlayers', value: Number(e.target.value) })}
              >
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <select
              className={styles.setFilter}
              value={settings.planechaseSetFilter}
              onChange={(e) => settingsDispatch({ type: 'SET', key: 'planechaseSetFilter', value: e.target.value })}
            >
              {PLANECHASE_SETS.map((s) => (
                <option key={s.value} value={s.value}>{s.value === '' ? t('planechase.allSets') : s.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.deckQuickActions}>
            <button className={styles.linkBtn} onClick={buildForMe} disabled={allCards.length === 0}>
              {t('planechase.buildForMe')}
            </button>
            <button className={styles.linkBtn} onClick={() => deck.addAll(allCards)} disabled={allCards.length === 0}>
              {t('planechase.addAll')}
            </button>
            <button className={styles.linkBtn} onClick={deck.clearDeck} disabled={deck.deckSize === 0}>
              {t('planechase.clear')}
            </button>
          </div>

          {loadingAll && <div className={styles.message}>{t('planechase.loadingCards')}</div>}

          {groupedCards.length > 0 && renderGroupedGrid(true)}
        </>
      )}

      {/* Hover / long-press preview */}
      {previewCard && previewPos && (() => {
        const previewUrl = getImageUri(previewCard, 'normal');
        const isLandscapePreview = previewCard.layout === 'planar';
        const previewH = isLandscapePreview ? 240 : 460;
        // Always show above the card; only fall below if no room at top
        const top = previewPos.y > previewH + 12
          ? previewPos.y - previewH - 12
          : previewPos.y + 180;
        return previewUrl ? (
          <div className={styles.previewTooltip} style={{ top, left: previewPos.x }}>
            <img
              className={isLandscapePreview ? styles.previewImgRotated : styles.previewImg}
              src={previewUrl}
              alt={previewCard.name}
            />
            <div className={styles.previewName}>{previewCard.name}</div>
          </div>
        ) : null;
      })()}

      {/* Card detail bottom sheet */}
      {selectedCard && (() => {
        const detailUrl = getImageUri(selectedCard, 'normal');
        const isLandscapeDetail = selectedCard.layout === 'planar';
        const qty = deck.getQty(selectedCard.id);
        return (
          <div className={styles.detailOverlay} onClick={closeDetail}>
            <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
              <button className={styles.detailClose} onClick={closeDetail}>&times;</button>
              {detailUrl && (
                <img
                  className={isLandscapeDetail ? styles.detailImgRotated : styles.detailImg}
                  src={detailUrl}
                  alt={selectedCard.name}
                />
              )}
              <div className={styles.detailName}>{selectedCard.name}</div>
              <div className={styles.detailType}>{selectedCard.type_line}</div>
              <div className={styles.detailActions}>
                {!deck.isPlaying && (
                  <button className={styles.btnNext} onClick={() => planeswalkTo(selectedCard)}>
                    {t('planechase.planeswalkHere')}
                  </button>
                )}
                <button className={styles.btnPrint} onClick={() => handlePrintCard(selectedCard)} disabled={status !== 'ready'}>
                  {t('planechase.print')}
                </button>
              </div>
              <div className={styles.detailDeckRow}>
                {qty > 0 ? (
                  <button
                    className={styles.deckBtnMinus}
                    onClick={() => deck.removeCard(selectedCard.id)}
                    aria-label="Remove from deck"
                  >−</button>
                ) : (
                  <button
                    className={styles.deckBtnPlus}
                    onClick={() => deck.addCard(selectedCard)}
                    disabled={!canAddToDeck(selectedCard)}
                    aria-label="Add to deck"
                  >+</button>
                )}
                <span className={styles.detailDeckQty}>{qty > 0 ? t('planechase.inDeck') : t('planechase.notInDeck')}</span>
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
            <div className={styles.dialogTitle}>{t('planechase.invalidDeck')}</div>
            <div className={styles.dialogBody}>
              {!deck.isLegal && <p>Need at least {minDeckSize} cards (currently {deck.deckSize}).</p>}
              {!phenomenaLegal && <p>Too many phenomena: {phenomenaInDeck}/{maxPhenomena} allowed.</p>}
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.btnNext} onClick={() => { setShowInvalidDialog(false); handleStartDeck(); }}>
                {t('planechase.playAnyway')}
              </button>
              <button className={styles.btnSmall} onClick={() => { setShowInvalidDialog(false); setActiveTab('build'); }}>
                {t('planechase.editDeck')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.message}>{message}</div>
    </div>
  );
}
