import { format } from 'date-fns';
import { nl as nlLocale } from 'date-fns/locale';

import { parseLocalDate } from './expiry';

/** Local 'YYYY-MM-DD' (never toISOString: that shifts the day around midnight). */
export function toYmd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** "vrijdag 20 november" */
export function formatLongDate(d: Date): string {
  return format(d, 'EEEE d MMMM', { locale: nlLocale });
}

/** "20 nov 2026" */
export function formatShortDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return format(date, 'd MMM yyyy', { locale: nlLocale });
}

/** "vrijdag 20 november 2026" for a stored 'YYYY-MM-DD'. */
export function formatYmd(ymd: string): string {
  return format(parseLocalDate(ymd), 'EEEE d MMMM yyyy', { locale: nlLocale });
}
