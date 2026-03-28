import { useSettings, useSettingsDispatch } from '../context/SettingsContext.tsx';
import styles from './SettingsPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: Props) {
  const settings = useSettings();
  const dispatch = useSettingsDispatch();

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Printing */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Printing</div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Auto-print</div>
              <div className={styles.rowDesc}>Print immediately when a card is selected</div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.autoPrint}
                onChange={(e) => dispatch({ type: 'SET', key: 'autoPrint', value: e.target.checked })}
              />
            </label>
          </div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Print Art</div>
              <div className={styles.rowDesc}>Include card artwork in thermal print</div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.printArt}
                onChange={(e) => dispatch({ type: 'SET', key: 'printArt', value: e.target.checked })}
              />
            </label>
          </div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Hide Preview</div>
              <div className={styles.rowDesc}>Don't show the card image on screen</div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.hidePreview}
                onChange={(e) => dispatch({ type: 'SET', key: 'hidePreview', value: e.target.checked })}
              />
            </label>
          </div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Dithering</div>
              <div className={styles.rowDesc}>Algorithm for converting images to B&W</div>
            </div>
            <div className={styles.selectWrap}>
              <select
                value={settings.ditheringMode}
                onChange={(e) => dispatch({ type: 'SET', key: 'ditheringMode', value: e.target.value })}
              >
                <option value="floyd-steinberg">Floyd-Steinberg</option>
                <option value="threshold">Threshold</option>
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Paper Feed</div>
              <div className={styles.rowDesc}>Spacing after each print</div>
            </div>
            <div className={styles.selectWrap}>
              <select
                value={settings.paperFeed}
                onChange={(e) => dispatch({ type: 'SET', key: 'paperFeed', value: e.target.value })}
              >
                <option value="none">None</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Cards</div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Include Un-sets</div>
              <div className={styles.rowDesc}>Include silver-border / Acorn cards in Momir</div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.includeFunny}
                onChange={(e) => dispatch({ type: 'SET', key: 'includeFunny', value: e.target.checked })}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
