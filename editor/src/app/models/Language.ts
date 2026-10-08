export type AppLanguage = 'system' | 'de' | 'en';
export type TranslationLanguage = Exclude<AppLanguage, 'system'>;

export const APP_LANGUAGES: readonly AppLanguage[] = ['system', 'de', 'en'];

export function getSystemLanguage(): TranslationLanguage {
  return navigator.language.toLowerCase().split('-')[0] === 'de' ? 'de' : 'en';
}
