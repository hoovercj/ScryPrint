import styles from './InfoPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InfoPanel({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>About ScryPrint</span>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.section}>
          <p className={styles.text}>
            Print MTG cards, tokens, and counters on Phomemo thermal printers
            via Web Bluetooth. Just connect from your browser, no app or downloads required!
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Supported Printers</div>
          <p className={styles.text}>
            Phomemo T02, M02, M02S, M02 Pro, M04S, M04AS — any of the simple "continuous feed" Phomemo BLE
            thermal printers should work. The printers that print individual pre-cut labels or stickers are unlikely to work. The printer is auto-detected on connect.
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Browser Support</div>
          <p className={styles.text}>
            Requires Web Bluetooth API. Supported in Chrome, Edge, and Opera
            on desktop and Android. Not available in Firefox or Safari.
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Links</div>
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
          <div className={styles.sectionLabel}>Credits</div>
          <p className={styles.text}>
            Card data and images provided by Scryfall. Creature database
            from MTGJSON. Mana symbols by mana-font. Inspired by the
            [momir.io project](https://momir.io) by Devin Cooper.
          </p>
          <span className={styles.badge}>v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
