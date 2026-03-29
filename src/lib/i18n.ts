export type LangCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'ru' | 'zhs' | 'zht';

export interface LangDef {
  code: LangCode;
  flag: string;
  name: string;
}

export const LANGUAGES: LangDef[] = [
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'pt', flag: '🇧🇷', name: 'Português' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  { code: 'zhs', flag: '🇨🇳', name: '简体中文' },
  { code: 'zht', flag: '🇹🇼', name: '繁體中文' },
];

export function getLangDef(code: LangCode): LangDef {
  return LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0];
}
