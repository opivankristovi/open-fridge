import { differenceInCalendarDays } from 'date-fns';

import {
  describeDaysLeft,
  effectiveExpiry,
  notificationTriggers,
  type ExpiryInput,
} from '../domain/expiry';
import type { Item } from '../types/db';

/** Pure module: no native imports, so it can be unit-tested. */
export type SchedulePrefs = { warnDays: number; notifyHour: number };
export type ScheduleItem = ExpiryInput & Pick<Item, 'id' | 'name'>;

export type ScheduledEntry = {
  date: Date;
  title: string;
  body: string;
  data: { itemId: string };
};

/** Android limits the number of pending alarms; stay well below it. */
export const MAX_SCHEDULED = 400;

export const WARN_TITLE = 'Bijna over datum';
export const EXPIRY_TITLE = 'Laatste dag';

export function buildSchedule(
  items: ScheduleItem[],
  prefs: SchedulePrefs,
  now: Date,
): ScheduledEntry[] {
  const out: ScheduledEntry[] = [];
  for (const item of items) {
    const expiry = effectiveExpiry(item);
    if (!expiry) continue;
    for (const t of notificationTriggers(item, prefs.warnDays, prefs.notifyHour, now)) {
      if (t.kind === 'warn') {
        // Days left as seen on the day the notification fires, not today.
        const daysAtTrigger = differenceInCalendarDays(expiry.date, t.date);
        out.push({
          date: t.date,
          title: WARN_TITLE,
          body: `${item.name}: ${describeDaysLeft(daysAtTrigger)}`,
          data: { itemId: item.id },
        });
      } else {
        out.push({
          date: t.date,
          title: EXPIRY_TITLE,
          body: `${item.name} moet vandaag op of weg`,
          data: { itemId: item.id },
        });
      }
    }
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out.slice(0, MAX_SCHEDULED);
}
