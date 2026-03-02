import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

import ru from './ru.json';
import kz from './kz.json';

const i18n = new I18n({
  ru,
  kz,
});

// Detect locale: map 'kk' (Kazakh BCP-47) → 'kz' (our key), default to 'ru'
function detectLocale(): 'ru' | 'kz' {
  const locales = Localization.getLocales();
  const tag = locales[0]?.languageTag ?? 'ru';
  const lang = tag.split('-')[0].toLowerCase();
  return lang === 'kk' ? 'kz' : 'ru';
}

i18n.locale = detectLocale();
i18n.enableFallback = true;
i18n.defaultLocale = 'ru';

export { i18n };

export function setLocale(locale: 'ru' | 'kz') {
  i18n.locale = locale;
}

export function t(scope: string, options?: Record<string, unknown>): string {
  return i18n.t(scope, options);
}
