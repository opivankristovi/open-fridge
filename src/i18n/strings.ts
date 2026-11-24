import type { Locale as DateFnsLocale } from 'date-fns';
import { de as deDate, enGB, enUS, fr as frDate, nl as nlDate, nlBE } from 'date-fns/locale';

import { de } from './de';
import { en } from './en';
import { fr } from './fr';
import { nl, type Strings } from './nl';

/**
 * Pure module (no native imports) holding the active UI language, so domain code,
 * services and unit tests can use it. Device detection lives in ./index.ts.
 */

export type Lang = 'nl' | 'en' | 'fr' | 'de';
export type { Strings };

export const SUPPORTED_LANGS: readonly Lang[] = ['nl', 'en', 'fr', 'de'];
/** Used when none of the device's preferred languages is supported. */
export const FALLBACK_LANG: Lang = 'en';

const TABLES: Record<Lang, Strings> = { nl, en, fr, de };

/** Minimal shape of an expo-localization Locale, so this module stays pure. */
export type LocaleLike = { languageCode: string | null; regionCode: string | null };

export let lang: Lang = FALLBACK_LANG;
let region: string | null = null;

/** Active translation table. Read it at render/call time (`t.x`), never cache it at module load. */
export let t: Strings = TABLES[lang];

function isLang(code: string | null | undefined): code is Lang {
  return !!code && (SUPPORTED_LANGS as readonly string[]).includes(code);
}

/** First supported language in the user's preference order, else the fallback. */
export function resolveLanguage(locales: readonly LocaleLike[]): { lang: Lang; region: string | null } {
  for (const l of locales) {
    const code = l.languageCode?.toLowerCase();
    if (isLang(code)) return { lang: code, region: l.regionCode?.toUpperCase() ?? null };
  }
  return { lang: FALLBACK_LANG, region: null };
}

export function setLanguage(next: Lang, nextRegion: string | null = null): void {
  lang = next;
  region = nextRegion;
  t = TABLES[next];
}

/** US English writes month before day; every other table's own patterns apply as-is. */
const US_DATE_FORMATS: Strings['dateFormats'] = {
  long: 'EEEE, MMMM d',
  short: 'MMM d, yyyy',
  full: 'EEEE, MMMM d, yyyy',
};

/** date-fns format patterns for the active language and region. */
export function dateFormats(): Strings['dateFormats'] {
  return lang === 'en' && region === 'US' ? US_DATE_FORMATS : t.dateFormats;
}

/** date-fns locale matching the active language (and region where it matters). */
export function dateLocale(): DateFnsLocale {
  switch (lang) {
    case 'nl':
      return region === 'BE' ? nlBE : nlDate;
    case 'en':
      return region === 'US' ? enUS : enGB;
    case 'fr':
      return frDate;
    case 'de':
      return deDate;
  }
}
