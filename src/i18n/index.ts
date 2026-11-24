import { getLocales, useLocales } from 'expo-localization';

import { resolveLanguage, setLanguage, type Lang } from './strings';

export * from './strings';

// Pick the language as soon as this module loads (also in headless background tasks).
{
  const r = resolveLanguage(getLocales());
  setLanguage(r.lang, r.region);
}

/**
 * Follows the device language (or Android's per-app language) while the app runs.
 * Returns the active language; use it as a `key` so the tree remounts with the new strings.
 */
export function useSystemLanguage(): Lang {
  const locales = useLocales();
  const r = resolveLanguage(locales);
  // Idempotent module update during render, so children rendered in this pass already see it.
  setLanguage(r.lang, r.region);
  return r.lang;
}
