/**
 * Unit tests for locale system.
 *
 * Verifies:
 * - Every locale file covers all keys defined in en.ts
 * - No locale has extra keys not in en.ts
 * - LangCode type matches LANGUAGES array
 */
import { describe, it, expect } from 'vitest';
import en from '../../src/locales/en.ts';
import es from '../../src/locales/es.ts';
import fr from '../../src/locales/fr.ts';
import de from '../../src/locales/de.ts';
import it_ from '../../src/locales/it.ts';
import pt from '../../src/locales/pt.ts';
import ja from '../../src/locales/ja.ts';
import ko from '../../src/locales/ko.ts';
import ru from '../../src/locales/ru.ts';
import zhs from '../../src/locales/zhs.ts';
import zht from '../../src/locales/zht.ts';
import { LANGUAGES } from '../../src/lib/i18n.ts';

const enKeys = Object.keys(en) as string[];

const locales: Record<string, Record<string, string>> = {
  es, fr, de, it: it_, pt, ja, ko, ru, zhs, zht,
};

describe('Locale completeness', () => {
  for (const [code, locale] of Object.entries(locales)) {
    it(`${code}.ts has all keys from en.ts`, () => {
      const missing = enKeys.filter(k => !(k in locale));
      expect(missing, `Missing keys in ${code}: ${missing.join(', ')}`).toEqual([]);
    });

    it(`${code}.ts has no extra keys`, () => {
      const extra = Object.keys(locale).filter(k => !enKeys.includes(k));
      expect(extra, `Extra keys in ${code}: ${extra.join(', ')}`).toEqual([]);
    });

    it(`${code}.ts has no empty values`, () => {
      const empty = Object.entries(locale).filter(([, v]) => v === '').map(([k]) => k);
      expect(empty, `Empty values in ${code}: ${empty.join(', ')}`).toEqual([]);
    });
  }
});

describe('LANGUAGES array', () => {
  it('has the right number of languages', () => {
    // en + 10 others
    expect(LANGUAGES.length).toBe(11);
  });

  it('every LANGUAGES entry has code and name', () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
    }
  });

  it('every LANGUAGES code has a matching locale file', () => {
    const allLocales = { en, ...locales };
    for (const lang of LANGUAGES) {
      expect(lang.code in allLocales, `No locale file for ${lang.code}`).toBe(true);
    }
  });

  it('no LANGUAGES entry has a flag field', () => {
    for (const lang of LANGUAGES) {
      expect('flag' in lang, `${lang.code} still has a flag field`).toBe(false);
    }
  });
});
