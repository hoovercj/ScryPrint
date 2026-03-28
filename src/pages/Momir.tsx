import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings, useSettingsDispatch } from '../context/SettingsContext.tsx';
import { usePrinter } from '../hooks/usePrinter.ts';
import { renderCardToCanvas, type CardRenderData } from '../lib/printer/thermalRenderer.ts';
import { scryfallImageUrl, fetchCardArt } from '../lib/scryfall.ts';
import { FormatInfo } from '../components/FormatInfo.tsx';
import styles from './Momir.module.css';

interface Creature {
  n: string;
  t: string;
  p: string;
  h: string;
  x: string;
  m: string;
  f: boolean;
}

type CreaturesDB = Record<string, Creature[]>;

/** 'idle' = card back, 'back' = showing card back while loading, 'ready' = card visible */
type CardPhase = 'idle' | 'back' | 'ready';

const HIDDEN_ROLL_MESSAGES = [
  'Card rolled! But that\'s a secret.',
  'A creature lurks face-down...',
  'Rolled! No peeking.',
  'Something was summoned...',
  'The aether stirs. Card hidden.',
];

export function Momir() {
  const settings = useSettings();
  const settingsDispatch = useSettingsDispatch();
  const { status, print } = usePrinter();

  const [db, setDb] = useState<CreaturesDB | null>(null);
  const [selectedMV, setSelectedMV] = useState<number | null>(null);
  const [currentCard, setCurrentCard] = useState<Creature | null>(null);
  const [message, setMessage] = useState('Loading card database...');
  const [phase, setPhase] = useState<CardPhase>('idle');
  const hiddenRollRef = useRef(0);

  // Load creatures.json
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/creatures.json')
      .then(r => r.json())
      .then((data: CreaturesDB) => {
        setDb(data);
        setMessage('Pick a mana value and roll');
      })
      .catch(() => {
        setMessage('Failed to load card database');
      });
  }, []);

  const roll = useCallback(() => {
    if (selectedMV === null || !db) return;
    const bucket = db[String(selectedMV)] || [];
    const filtered = settings.includeFunny ? bucket : bucket.filter(c => !c.f);
    if (filtered.length === 0) {
      setCurrentCard(null);
      setPhase('idle');
      setMessage('No creatures at this mana value');
      return;
    }
    const creature = filtered[Math.floor(Math.random() * filtered.length)];

    // Transition: show card back → load new image → reveal
    setPhase('back');
    setCurrentCard(creature);

    if (settings.hidePreview) {
      const idx = hiddenRollRef.current;
      setMessage(HIDDEN_ROLL_MESSAGES[idx % HIDDEN_ROLL_MESSAGES.length]);
      hiddenRollRef.current = idx + 1;
    } else {
      setMessage('');
    }
  }, [selectedMV, db, settings.includeFunny, settings.hidePreview]);

  // Auto-print when card changes
  useEffect(() => {
    if (!currentCard || !settings.autoPrint || status !== 'ready') return;
    handlePrint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard]);

  const handlePrint = async () => {
    if (!currentCard) return;
    setMessage('Printing...');
    try {
      const cardData: CardRenderData = {
        name: currentCard.n,
        manaCost: currentCard.m,
        typeLine: currentCard.t,
        oracleText: currentCard.x,
        power: currentCard.p,
        toughness: currentCard.h,
      };

      let artImg: ImageBitmap | null = null;
      if (settings.printArt) {
        try {
          artImg = await fetchCardArt(scryfallImageUrl(currentCard.n, 'art_crop'));
        } catch {
          // Art fetch failed, print without it
        }
      }

      const canvas = renderCardToCanvas(cardData, artImg);
      await print(canvas);
      setMessage(`Printed: ${currentCard.n}`);
    } catch (e) {
      setMessage(`Print failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const pt = currentCard?.p && currentCard?.h ? `${currentCard.p} / ${currentCard.h}` : '';

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.header}>Momir</h2>
        <FormatInfo
          title="Momir"
          description="Inspired by Momir Vig on MTGO. Discard a card and pay X to create a token copy of a random creature with mana value X. A fun way to discover creatures you’ve never seen!"
          rulesUrl="https://magic.wizards.com/en/formats/momir"
          rulesLabel="Momir Vig on MTGO"
        />
      </div>

      <div className={styles.mvPicker}>
        {Array.from({ length: 17 }, (_, i) => (
          <button
            key={i}
            className={styles.mvBtn}
            data-selected={selectedMV === i}
            onClick={() => setSelectedMV(i)}
          >
            {i}
          </button>
        ))}
      </div>

      <div className={styles.toggles}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.autoPrint}
            onChange={(e) => settingsDispatch({ type: 'SET', key: 'autoPrint', value: e.target.checked })}
          />
          Auto-print
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.includeFunny}
            onChange={(e) => settingsDispatch({ type: 'SET', key: 'includeFunny', value: e.target.checked })}
          />
          Include Un-sets
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.printArt}
            onChange={(e) => settingsDispatch({ type: 'SET', key: 'printArt', value: e.target.checked })}
          />
          Print Art
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.hidePreview}
            onChange={(e) => settingsDispatch({ type: 'SET', key: 'hidePreview', value: e.target.checked })}
          />
          Hide Preview
        </label>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.btnRoll}
          onClick={roll}
          disabled={selectedMV === null || !db}
        >
          Roll
        </button>
        <button
          className={styles.btnPrint}
          onClick={handlePrint}
          disabled={!currentCard || status !== 'ready'}
        >
          Print
        </button>
      </div>

      <div className={styles.message}>{message}</div>

      <div className={styles.cardArea}>
        {/* Card back layer */}
        <img
          className={styles.cardImg}
          data-layer="back"
          data-visible={phase !== 'ready' || settings.hidePreview}
          src={`${import.meta.env.BASE_URL}card-back.jpg`}
          alt="Card back"
        />

        {/* Card face layer — hidden until image loads */}
        {currentCard && !settings.hidePreview && (
          <img
            className={styles.cardImg}
            data-layer="front"
            data-visible={phase === 'ready'}
            key={currentCard.n}
            src={scryfallImageUrl(currentCard.n)}
            alt={currentCard.n}
            crossOrigin="anonymous"
            onLoad={() => setPhase('ready')}
            onError={() => setPhase('ready')}
          />
        )}

        {/* Card info */}
        {currentCard && !settings.hidePreview && phase === 'ready' && (
          <div className={styles.cardInfo}>
            <div className={styles.cardName}>{currentCard.n}</div>
            <div className={styles.cardType}>{currentCard.t}</div>
            {currentCard.x && <div className={styles.cardText}>{currentCard.x}</div>}
            {pt && <div className={styles.cardPt}>{pt}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
