import * as Localization from 'expo-localization';

import ru from './ru.json';
import kz from './kz.json';

const translations: Record<string, any> = { ru, kz };
let currentLocale: 'ru' | 'kz' = 'ru';

// Detect locale: map 'kk' (Kazakh BCP-47) → 'kz' (our key), default to 'ru'
function detectLocale(): 'ru' | 'kz' {
  const locales = Localization.getLocales();
  const tag = locales[0]?.languageTag ?? 'ru';
  const lang = tag.split('-')[0].toLowerCase();
  return lang === 'kk' ? 'kz' : 'ru';
}

currentLocale = detectLocale();

export function t(key: string, options?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations[currentLocale];
  for (const k of keys) {
    value = value?.[k];
  }
  if (!value) {
    // Fallback to Russian
    let fallback: any = translations.ru;
    for (const k of keys) {
      fallback = fallback?.[k];
    }
    return fallback ?? key;
  }
  if (options) {
    return Object.entries(options).reduce(
      (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
      value,
    );
  }
  return value;
}

export function setLocale(locale: 'ru' | 'kz') {
  currentLocale = locale;
}

export function getLocale(): 'ru' | 'kz' {
  return currentLocale;
}
