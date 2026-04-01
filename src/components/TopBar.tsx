import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePrinter } from '../hooks/usePrinter.ts';
import { useLocale } from '../hooks/useLocale.ts';
import { useSettingsDispatch } from '../context/SettingsContext.tsx';
import { LANGUAGES } from '../lib/i18n.ts';
import { InfoPanel } from './InfoPanel.tsx';
import styles from './TopBar.module.css';

const MODES = [
  { path: '/momir', labelKey: 'nav.momir' as const, icon: 'ms ms-creature' },
  { path: '/planechase', labelKey: 'nav.planechase' as const, icon: 'ms ms-planeswalker' },
  { path: '/archenemy', labelKey: 'nav.archenemy' as const, icon: 'ms ms-scheme' },
  { path: '/browse', labelKey: 'nav.browse' as const, icon: 'ms ms-ability-investigate' },
] as const;

const NAV_INLINE_QUERY = '(min-width: 768px)';

export function TopBar() {
  const { status, modelName, connect, disconnect } = usePrinter();
  const { t, language } = useLocale();
  const dispatch = useSettingsDispatch();
  const [infoOpen, setInfoOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isModePage = MODES.some(m => m.path === location.pathname);

  // Whether the nav tabs fit inline next to the logo
  const [navInline, setNavInline] = useState(() => window.matchMedia(NAV_INLINE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NAV_INLINE_QUERY);
    const handler = (e: MediaQueryListEvent) => setNavInline(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync CSS custom property with actual topbar height (handles wrap)
  const topbarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--topbar-height', `${entry.borderBoxSize[0].blockSize}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close language picker on outside click
  useEffect(() => {
    if (!langOpen) return;
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langOpen]);

  const handleConnect = async () => {
    try {
      if (status === 'ready') {
        disconnect();
      } else {
        await connect();
      }
    } catch {
      // User cancelled or connection failed — dispatch already handled
    }
  };

  const statusLabel =
    status === 'ready' && modelName
      ? `${modelName} ${t('topbar.connected')}`
      : status === 'disconnected' ? t('topbar.disconnected')
      : status === 'connecting' ? t('topbar.connecting')
      : status === 'printing' ? t('topbar.printing')
      : t('topbar.ready');

  const navTabs = MODES.map((m) => (
    <Link
      key={m.path}
      to={m.path}
      className={styles.modeTab}
      data-active={location.pathname === m.path}
    >
      <i className={m.icon} />
      <span className={styles.modeTabLabel}>{t(m.labelKey)}</span>
    </Link>
  ));

  return (
    <>
      <header className={styles.topbar} ref={topbarRef}>
        <Link to="/" className={styles.brand}>
          <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" className={styles.brandIcon} />
          ScryPrint
        </Link>
        {isModePage && navInline && (
          <nav className={styles.modeNav}>{navTabs}</nav>
        )}
        <div className={styles.right}>
          <div className={styles.statusDot} data-status={status} />
          <span className={styles.statusText}>{statusLabel}</span>
          <button
            className={styles.connectBtn}
            onClick={handleConnect}
            disabled={status === 'connecting' || status === 'printing'}
          >
            {status === 'ready' ? t('topbar.disconnect') : t('topbar.connect')}
          </button>
          <div className={styles.langPicker} ref={langRef}>
            <button
              className={styles.langBtn}
              onClick={() => setLangOpen(o => !o)}
              aria-label="Language"
            >
              <svg className={styles.globeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className={styles.langBtnCode}>{language.toUpperCase()}</span>
            </button>
            {langOpen && (
              <div className={styles.langDropdown}>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    className={styles.langOption}
                    data-active={language === lang.code}
                    onClick={() => { dispatch({ type: 'SET', key: 'language', value: lang.code }); setLangOpen(false); }}
                  >
                    <span className={styles.langCode}>{lang.code.toUpperCase()}</span>
                    <span className={styles.langName}>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={styles.settingsBtn}
            onClick={() => setInfoOpen(true)}
            aria-label="About"
          >
            ℹ
          </button>
        </div>
        {isModePage && !navInline && (
          <nav className={`${styles.modeNav} ${styles.modeNavRow}`}>{navTabs}</nav>
        )}
      </header>
      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}
