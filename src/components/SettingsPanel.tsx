import { useSettings, useSettingsDispatch } from '../context/SettingsContext.tsx';
import { useLocale } from '../hooks/useLocale.ts';
import { LANGUAGES } from '../lib/i18n.ts';
import styles from './SettingsPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: Props) {
  const settings = useSettings();
  const dispatch = useSettingsDispatch();
  const { t } = useLocale();

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('settings.title')}</span>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Printing */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.printing')}</div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>{t('settings.autoprint')}</div>
              <div className={styles.rowDesc}>{t('settings.autoprint.desc')}</div>
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
              <div className={styles.rowLabel}>{t('settings.printArt')}</div>
              <div className={styles.rowDesc}>{t('settings.printArt.desc')}</div>
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
              <div className={styles.rowLabel}>{t('settings.hidePreview')}</div>
              <div className={styles.rowDesc}>{t('settings.hidePreview.desc')}</div>
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
              <div className={styles.rowLabel}>{t('settings.dithering')}</div>
              <div className={styles.rowDesc}>{t('settings.dithering.desc')}</div>
            </div>
            <div className={styles.selectWrap}>
              <select
                value={settings.ditheringMode}
                onChange={(e) => dispatch({ type: 'SET', key: 'ditheringMode', value: e.target.value })}
              >
                <option value="floyd-steinberg">{t('settings.floydSteinberg')}</option>
                <option value="threshold">{t('settings.threshold')}</option>
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>{t('settings.paperFeed')}</div>
              <div className={styles.rowDesc}>{t('settings.paperFeed.desc')}</div>
            </div>
            <div className={styles.selectWrap}>
              <select
                value={settings.paperFeed}
                onChange={(e) => dispatch({ type: 'SET', key: 'paperFeed', value: e.target.value })}
              >
                <option value="none">{t('settings.none')}</option>
                <option value="single">{t('settings.single')}</option>
                <option value="double">{t('settings.double')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.cards')}</div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>{t('settings.unSets')}</div>
              <div className={styles.rowDesc}>{t('settings.unSets.desc')}</div>
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

        {/* Language */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.language')}</div>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>{t('settings.language')}</div>
              <div className={styles.rowDesc}>{t('settings.language.desc')}</div>
            </div>
            <div className={styles.selectWrap}>
              <select
                value={settings.language}
                onChange={(e) => dispatch({ type: 'SET', key: 'language', value: e.target.value })}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
