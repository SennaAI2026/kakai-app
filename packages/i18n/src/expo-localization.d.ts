declare module 'expo-localization' {
  interface Locale {
    languageTag: string;
    languageCode: string | null;
    regionCode: string | null;
    currencyCode: string | null;
    currencySymbol: string | null;
    decimalSeparator: string | null;
    digitGroupingSeparator: string | null;
    textDirection: 'ltr' | 'rtl' | null;
    measurementSystem: string | null;
    temperatureUnit: string | null;
  }

  export function getLocales(): Locale[];
  export function getCalendars(): Array<{ calendar: string | null; timeZone: string | null; uses24hourClock: boolean | null; firstWeekday: number | null }>;
}
