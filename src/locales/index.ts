import en from './en.ts';
import es from './es.ts';
import fr from './fr.ts';
import de from './de.ts';
import it from './it.ts';
import pt from './pt.ts';
import ja from './ja.ts';
import ko from './ko.ts';
import ru from './ru.ts';
import zhs from './zhs.ts';
import zht from './zht.ts';
import type { LocaleKey } from './en.ts';
import type { LangCode } from '../lib/i18n.ts';

const locales: Record<LangCode, Record<LocaleKey, string>> = {
  en, es, fr, de, it, pt, ja, ko, ru, zhs, zht,
};

export function t(lang: LangCode, key: LocaleKey): string {
  return locales[lang]?.[key] ?? locales.en[key] ?? key;
}

export type { LocaleKey };
