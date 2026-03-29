import { useState } from 'react';
import { useLocale } from '../hooks/useLocale.ts';
import styles from './InfoPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InfoPanel({ open, onClose }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { t } = useLocale();

  if (!open) return null;

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    localStorage.clear();
    setConfirmReset(false);
    window.location.reload();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('info.title')}</span>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.section}>
          <p className={styles.text}>
            {t('info.desc')}
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('info.printers')}</div>
          <p className={styles.text}>
            {t('info.printers.desc')}
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('info.browser')}</div>
          <p className={styles.text}>
            {t('info.browser.desc')}
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('info.links')}</div>
          <ul className={styles.linkList}>
            <li>
              <a href="https://github.com/cohoov/MTGThermalPrinter" target="_blank" rel="noopener noreferrer">
                GitHub Repository
              </a>
            </li>
            <li>
              <a href="https://github.com/cohoov/MTGThermalPrinter/issues" target="_blank" rel="noopener noreferrer">
                Report a Bug
              </a>
            </li>
            <li>
              <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer">
                Scryfall — Card Data & Images
              </a>
            </li>
            <li>
              <a href="https://mtgjson.com" target="_blank" rel="noopener noreferrer">
                MTGJSON — Creature Database
              </a>
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('info.credits')}</div>
          <p className={styles.text}>
            {t('info.credits.desc')}
          </p>
          <span className={styles.badge}>v{__APP_VERSION__}</span>
        </div>

        <div className={styles.section}>
          <button
            className={confirmReset ? styles.resetBtnConfirm : styles.resetBtn}
            onClick={handleReset}
          >
            {confirmReset ? t('info.resetConfirm') : t('info.reset')}
          </button>
          <p className={styles.text} style={{ fontSize: 12 }}>
            {t('info.resetDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}
