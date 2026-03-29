import { useCallback } from 'react';
import { useSettings } from '../context/SettingsContext.tsx';
import { t as translate, type LocaleKey } from '../locales/index.ts';

export function useLocale() {
  const { language } = useSettings();
  const t = useCallback((key: LocaleKey) => translate(language, key), [language]);
  return { t, language };
}
