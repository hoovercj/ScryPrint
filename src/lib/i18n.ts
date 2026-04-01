export type LangCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'ru' | 'zhs' | 'zht';

export interface LangDef {
  code: LangCode;
  name: string;
}

export const LANGUAGES: LangDef[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ru', name: 'Русский' },
  { code: 'zhs', name: '简体中文' },
  { code: 'zht', name: '繁體中文' },
];

export function getLangDef(code: LangCode): LangDef {
  return LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0];
}
