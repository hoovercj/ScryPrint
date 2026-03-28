import { Link } from 'react-router-dom';
import styles from './Landing.module.css';

const MODES = [
  {
    to: '/momir',
    icon: '🎲',
    name: 'Momir',
    desc: 'Roll a random creature by mana value',
  },
  {
    to: '/planechase',
    icon: '🌀',
    name: 'Planechase',
    desc: 'Draw a random plane and roll the planar die',
  },
  {
    to: '/archenemy',
    icon: '👑',
    name: 'Archenemy',
    desc: 'Set schemes in motion as the Archenemy',
  },
  {
    to: '/browse',
    icon: '🔍',
    name: 'Browse & Print',
    desc: 'Find any card, token, or emblem and print it',
  },
] as const;

export function Landing() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>ScryPrint</h1>
      <p className={styles.subtitle}>
        MTG cards on thermal paper. Connect your printer and pick a mode.
      </p>
      <div className={styles.modes}>
        {MODES.map((mode) => (
          <Link key={mode.to} to={mode.to} className={styles.modeCard}>
            <span className={styles.modeIcon}>{mode.icon}</span>
            <div className={styles.modeInfo}>
              <div className={styles.modeName}>{mode.name}</div>
              <div className={styles.modeDesc}>{mode.desc}</div>
            </div>
            <span className={styles.arrow}>›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
