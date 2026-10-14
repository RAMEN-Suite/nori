import { type Translation } from '@jsverse/transloco';
import german from './de.json';
import english from './en.json';
import italian from './it.json';

export type TranslationLanguage = 'de' | 'en' | 'it';
export type AppLanguage = 'system' | TranslationLanguage;

export class Languages {
  public static readonly translations: Readonly<Record<TranslationLanguage, Translation>> = {
    de: german,
    en: english,
    it: italian,
  };

  public static readonly defaultLanguage: TranslationLanguage = 'en';
  public static readonly supported: readonly TranslationLanguage[] = Object.keys(Languages.translations).filter(
    Languages.isSupported,
  );
  public static readonly options: readonly AppLanguage[] = ['system', ...Languages.supported];

  public static isSupported(language: string): language is TranslationLanguage {
    return Object.hasOwn(Languages.translations, language);
  }

  public static resolve(preferredLanguages: readonly string[]): TranslationLanguage {
    for (const preferred of preferredLanguages) {
      const normalized: string = preferred.toLowerCase();
      const exact: TranslationLanguage | undefined = Languages.supported.find(
        (language: TranslationLanguage): boolean => language.toLowerCase() === normalized,
      );
      if (exact) return exact;

      const base: string = normalized.split('-')[0] ?? normalized;
      const match: TranslationLanguage | undefined = Languages.supported.find(
        (language: TranslationLanguage): boolean => language.toLowerCase() === base,
      );
      if (match) return match;
    }

    return Languages.defaultLanguage;
  }
}
