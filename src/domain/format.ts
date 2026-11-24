import { format } from 'date-fns';

import { dateFormats, dateLocale } from '../i18n/strings';
import { parseLocalDate } from './expiry';

/** Local 'YYYY-MM-DD' (never toISOString: that shifts the day around midnight). */
export function toYmd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Weekday, day and month in the active language, e.g. "vrijdag 20 november". */
export function formatLongDate(d: Date): string {
  return format(d, dateFormats().long, { locale: dateLocale() });
}

/** Short date in the active language, e.g. "20 nov 2026". */
export function formatShortDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return format(date, dateFormats().short, { locale: dateLocale() });
}

/** Full date in the active language for a stored 'YYYY-MM-DD'. */
export function formatYmd(ymd: string): string {
  return format(parseLocalDate(ymd), dateFormats().full, { locale: dateLocale() });
}
