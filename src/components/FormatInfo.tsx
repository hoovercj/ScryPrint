import { useState, useRef, useEffect } from 'react';
import styles from './FormatInfo.module.css';

interface Props {
  title: string;
  description: string;
  rulesUrl: string;
  rulesLabel?: string;
}

export function FormatInfo({ title, description, rulesUrl, rulesLabel = 'Official Rules' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div
      className={styles.wrapper}
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={styles.infoBtn}
        onClick={() => setOpen(o => !o)}
        aria-label={`About ${title}`}
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="700">i</text>
        </svg>
      </button>
      {open && (
        <div className={styles.popover} role="tooltip">
          <p className={styles.desc}>{description}</p>
          <a
            className={styles.link}
            href={rulesUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {rulesLabel} ↗
          </a>
        </div>
      )}
    </div>
  );
}
