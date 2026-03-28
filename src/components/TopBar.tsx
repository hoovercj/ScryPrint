import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePrinter } from '../hooks/usePrinter.ts';
import { InfoPanel } from './InfoPanel.tsx';
import styles from './TopBar.module.css';

const MODES = [
  { path: '/momir', label: 'Momir' },
  { path: '/planechase', label: 'Planechase' },
  { path: '/archenemy', label: 'Archenemy' },
  { path: '/browse', label: 'Browse' },
] as const;

export function TopBar() {
  const { status, modelName, connect, disconnect } = usePrinter();
  const [infoOpen, setInfoOpen] = useState(false);
  const location = useLocation();

  const isModePage = MODES.some(m => m.path === location.pathname);

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
      ? `${modelName} Connected`
      : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <>
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand}>
          <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" className={styles.brandIcon} />
          ScryPrint
        </Link>
        {isModePage && (
          <nav className={styles.modeNav}>
            {MODES.map((m) => (
              <Link
                key={m.path}
                to={m.path}
                className={styles.modeTab}
                data-active={location.pathname === m.path}
              >
                {m.label}
              </Link>
            ))}
          </nav>
        )}
        <div className={styles.right}>
          <div className={styles.statusDot} data-status={status} />
          <span className={styles.statusText}>{statusLabel}</span>
          <button
            className={styles.connectBtn}
            onClick={handleConnect}
            disabled={status === 'connecting' || status === 'printing'}
          >
            {status === 'ready' ? 'Disconnect' : 'Connect'}
          </button>
          <button
            className={styles.settingsBtn}
            onClick={() => setInfoOpen(true)}
            aria-label="About"
          >
            ℹ
          </button>
        </div>
      </header>
      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}
