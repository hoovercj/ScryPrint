import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { usePrinter } from '../hooks/usePrinter.ts';
import { useSettings, useSettingsDispatch } from '../context/SettingsContext.tsx';
import { getRandomCard, searchCards, getImageUri, fetchCardArt, type ScryfallCard } from '../lib/scryfall.ts';
import { renderCardToCanvas } from '../lib/printer/thermalRenderer.ts';
import { FormatInfo } from '../components/FormatInfo.tsx';
import styles from './Planechase.module.css';

type DieResult = 'planeswalk' | 'chaos' | 'blank' | null;

/** 'idle' = card back, 'back' = showing card back during transition, 'ready' = card loaded */
type CardPhase = 'idle' | 'back' | 'ready';

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

  const [currentPlane, setCurrentPlane] = useState<ScryfallCard | null>(null);
  const [dieResult, setDieResult] = useState<DieResult>(null);
  const [rolling, setRolling] = useState(false);
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

  const collapsedSets = settings.planechaseCollapsedSets;

  // Reset stale set filter (e.g. old codes like set:hop/set:pc2/set:pca)
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

  const nextPlane = useCallback(async () => {
    setLoadingNext(true);
    setMessage('');
    setPhase('back');
    try {
      const card = await getRandomCard(buildQuery());
      setCurrentPlane(card);
      setDieResult(null);
    } catch (e) {
      setPhase(currentPlane ? 'ready' : 'idle');
      setMessage(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoadingNext(false);
    }
  }, [buildQuery, currentPlane]);

  const rollDie = useCallback(() => {
    setRolling(true);
    setDieResult(null);
    setTimeout(() => {
      const result = DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)];
      setDieResult(result);
      setRolling(false);
    }, 600);
  }, []);

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
  const prevFilterRef = useRef(settings.planechaseSetFilter);
  useEffect(() => {
    if (prevFilterRef.current !== settings.planechaseSetFilter) {
      prevFilterRef.current = settings.planechaseSetFilter;
      if (showAll) {
        fetchAllCards();
      }
    }
  }, [settings.planechaseSetFilter, showAll, fetchAllCards]);

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

  const selectCard = (card: ScryfallCard) => {
    setSelectedCard(card);
  };

  const closeDetail = () => setSelectedCard(null);

  const planeswalkTo = (card: ScryfallCard) => {
    setPhase('back');
    setCurrentPlane(card);
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
    if (!currentPlane) return;
    setMessage('Printing...');
    try {
      let artImg: ImageBitmap | null = null;
      if (settings.printArt) {
        const artUrl = getImageUri(currentPlane, 'art_crop');
        if (artUrl) {
          try { artImg = await fetchCardArt(artUrl); } catch { /* skip art */ }
        }
      }

      const canvas = renderCardToCanvas({
        name: currentPlane.name,
        typeLine: currentPlane.type_line,
        oracleText: currentPlane.oracle_text,
      }, artImg);
      await print(canvas);
      setMessage(`Printed: ${currentPlane.name}`);
    } catch (e) {
      setMessage(`Print failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const imageUrl = currentPlane ? getImageUri(currentPlane) : null;
  const isLandscapeCard = currentPlane?.layout === 'planar';
  const isAllSets = !settings.planechaseSetFilter;

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.header}>Planechase</h2>
        <FormatInfo
          title="Planechase"
          description="Players share a planar deck. Roll the planar die each turn — planeswalk to a new plane or trigger its chaos ability. Each plane has unique effects that alter gameplay."
          rulesUrl="https://magic.wizards.com/en/formats/planechase"
        />
      </div>

      {/* Planar Die */}
      <div className={styles.dieArea}>
        <button className={styles.die} data-rolling={rolling} onClick={rollDie} disabled={rolling}>
          {rolling ? '?' : <DieIcon result={dieResult ?? 'idle'} />}
        </button>
        <div className={styles.dieResult} data-result={dieResult || (rolling ? '' : 'idle')}>
          {dieResult === 'planeswalk' && <><i className="ms ms-planeswalker" /> Planeswalk!</>}
          {dieResult === 'chaos' && <><i className="ms ms-chaos" /> Chaos!</>}
          {dieResult === 'blank' && 'Nothing happens'}
          {!dieResult && !rolling && 'Roll the planar die\u2026'}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btnNext} onClick={nextPlane} disabled={loadingNext}>
          {loadingNext ? 'Loading...' : 'Planeswalk'}
        </button>
        <button className={styles.btnPrint} onClick={handlePrint} disabled={!currentPlane || status !== 'ready'}>
          Print
        </button>
      </div>

      <div className={styles.settings}>
        <select
          className={styles.setFilter}
          value={settings.planechaseSetFilter}
          onChange={(e) => settingsDispatch({ type: 'SET', key: 'planechaseSetFilter', value: e.target.value })}
        >
          {PLANECHASE_SETS.map((s) => (
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
            src={`${import.meta.env.BASE_URL}planechase-back.jpg`}
            alt="Planechase card back"
            className={styles.cardBackImg}
          />
        </div>

        {/* Card face layer — hidden until image loads */}
        {currentPlane && imageUrl && (
          <img
            className={isLandscapeCard ? styles.cardImgRotated : styles.cardImg}
            data-layer="front"
            data-visible={phase === 'ready'}
            key={currentPlane.id}
            src={imageUrl}
            alt={currentPlane.name}
            onLoad={() => setPhase('ready')}
            onError={() => setPhase('ready')}
          />
        )}
      </div>

      {/* Card info — outside the fixed card area */}
      {currentPlane && phase === 'ready' && (
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{currentPlane.name}</div>
          <div className={styles.cardType}>{currentPlane.type_line}</div>
        </div>
      )}

      {showAll && groupedCards.length > 0 && (
        <div className={styles.groupedGrid}>
          {isAllSets && (
            <div className={styles.collapseControls}>
              <button
                className={styles.collapseBtn}
                onClick={() => settingsDispatch({ type: 'SET', key: 'planechaseCollapsedSets', value: [] })}
              >
                Expand All
              </button>
              <button
                className={styles.collapseBtn}
                onClick={() => settingsDispatch({ type: 'SET', key: 'planechaseCollapsedSets', value: groupedCards.map(([name]) => name) })}
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
                        ? collapsedSets.filter(s => s !== setName)
                        : [...collapsedSets, setName];
                      settingsDispatch({ type: 'SET', key: 'planechaseCollapsedSets', value: next });
                    }}
                  >
                    <span className={styles.chevron} data-collapsed={isCollapsed}>▸</span>
                    {setName} ({cards.length})
                  </button>
                )}
                {!isCollapsed && (
                  <div className={styles.grid}>
                    {cards.map((card) => {
                      const url = getImageUri(card, 'small');
                      const isLandscape = card.layout === 'planar';
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
                            if (previewCard) { setPreviewCard(null); }
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
                          />
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
        const isLandscapePreview = previewCard.layout === 'planar';
        // Preview height ~228px for landscape (320 * 5/7), ~447px for portrait (320 * 7/5).
        // Show above the anchor by default; below if not enough room above.
        const previewH = isLandscapePreview ? 240 : 460;
        const showBelow = previewPos.y < previewH + 12;
        const top = showBelow ? previewPos.y + 60 : previewPos.y - previewH - 12;
        return previewUrl ? (
          <div
            className={styles.previewTooltip}
            style={{ top, left: previewPos.x }}
          >
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
                <button className={styles.btnNext} onClick={() => planeswalkTo(selectedCard)}>
                  Planeswalk Here
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
