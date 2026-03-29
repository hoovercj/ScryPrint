import { Link } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale.ts';
import type { LocaleKey } from '../locales/index.ts';
import styles from './Landing.module.css';

const MODES = [
  {
    to: '/momir',
    iconClass: 'ms ms-creature',
    nameKey: 'landing.momir' as LocaleKey,
    descKey: 'landing.momir.desc' as LocaleKey,
  },
  {
    to: '/planechase',
    iconClass: 'ms ms-planeswalker',
    nameKey: 'landing.planechase' as LocaleKey,
    descKey: 'landing.planechase.desc' as LocaleKey,
  },
  {
    to: '/archenemy',
    iconClass: 'ms ms-scheme',
    nameKey: 'landing.archenemy' as LocaleKey,
    descKey: 'landing.archenemy.desc' as LocaleKey,
  },
  {
    to: '/browse',
    iconClass: 'ms ms-ability-investigate',
    nameKey: 'landing.browse' as LocaleKey,
    descKey: 'landing.browse.desc' as LocaleKey,
  },
] as const;

export function Landing() {
  const { t } = useLocale();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>ScryPrint</h1>
      <p className={styles.subtitle}>
        {t('landing.subtitle')}
      </p>
      <div className={styles.modes}>
        {MODES.map((mode) => (
          <Link key={mode.to} to={mode.to} className={styles.modeCard}>
            <span className={styles.modeIcon}><i className={mode.iconClass} /></span>
            <div className={styles.modeInfo}>
              <div className={styles.modeName}>{t(mode.nameKey)}</div>
              <div className={styles.modeDesc}>{t(mode.descKey)}</div>
            </div>
            <span className={styles.arrow}>›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
