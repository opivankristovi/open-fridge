import { differenceInCalendarDays } from 'date-fns';

import {
  describeDaysLeft,
  effectiveExpiry,
  notificationTriggers,
  type ExpiryInput,
} from '../domain/expiry';
import { t } from '../i18n/strings';
import type { Item } from '../types/db';

/** Pure module: no native imports, so it can be unit-tested. */
export type SchedulePrefs = { warnDays: number; notifyHour: number };
export type ScheduleItem = ExpiryInput & Pick<Item, 'id' | 'name'>;

export type ScheduledEntry = {
  kind: 'warn' | 'expiry';
  date: Date;
  title: string;
  body: string;
  data: { itemId: string };
};

/** Android limits the number of pending alarms; stay well below it. */
export const MAX_SCHEDULED = 400;

export function buildSchedule(
  items: ScheduleItem[],
  prefs: SchedulePrefs,
  now: Date,
): ScheduledEntry[] {
  const out: ScheduledEntry[] = [];
  for (const item of items) {
    const expiry = effectiveExpiry(item);
    if (!expiry) continue;
    for (const trig of notificationTriggers(item, prefs.warnDays, prefs.notifyHour, now)) {
      if (trig.kind === 'warn') {
        // Days left as seen on the day the notification fires, not today.
        const daysAtTrigger = differenceInCalendarDays(expiry.date, trig.date);
        out.push({
          kind: 'warn',
          date: trig.date,
          title: t.notifications.warnTitle,
          body: `${item.name}: ${describeDaysLeft(daysAtTrigger)}`,
          data: { itemId: item.id },
        });
      } else {
        out.push({
          kind: 'expiry',
          date: trig.date,
          title: t.notifications.expiryTitle,
          body: t.notifications.expiryBody(item.name),
          data: { itemId: item.id },
        });
      }
    }
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out.slice(0, MAX_SCHEDULED);
}

/** 32-bit FNV-1a, base36. Deterministic, not cryptographic. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const ID_PREFIX = 'item:';

/** Stable identifier: a changed date, name or language yields a different id. */
export function entryId(e: ScheduledEntry): string {
  return `${ID_PREFIX}${e.data.itemId}:${e.kind}:${e.date.getTime()}:${hash(`${e.title}\n${e.body}`)}`;
}

export function parseEntryId(id: string): { itemId: string; kind: string; time: number } | null {
  if (!id.startsWith(ID_PREFIX)) return null;
  const parts = id.slice(ID_PREFIX.length).split(':');
  if (parts.length < 4) return null;
  // Item ids are not expected to contain ':' but be tolerant: the last 3 parts are fixed.
  const time = Number(parts[parts.length - 2]);
  const kind = parts[parts.length - 3];
  const itemId = parts.slice(0, parts.length - 3).join(':');
  if (!itemId || !kind || !Number.isFinite(time)) return null;
  return { itemId, kind, time };
}

/**
 * Diff between what is scheduled and what should be. Only `item:` ids are managed.
 * Entries that are already due but still pending (Android may deliver them late)
 * are kept as long as their item is still in stock.
 */
export function planResync(
  existingIds: string[],
  desired: ScheduledEntry[],
  inStockIds: Set<string>,
  now: Date,
  forceAll: boolean,
): { cancel: string[]; schedule: ScheduledEntry[] } {
  const managed = existingIds.filter((id) => parseEntryId(id) !== null);
  if (forceAll) return { cancel: managed, schedule: desired };
  const desiredIds = new Set(desired.map(entryId));
  const cancel = managed.filter((id) => {
    if (desiredIds.has(id)) return false;
    const p = parseEntryId(id);
    if (p && p.time <= now.getTime() && inStockIds.has(p.itemId)) return false;
    return true;
  });
  const existing = new Set(existingIds);
  return { cancel, schedule: desired.filter((e) => !existing.has(entryId(e))) };
}
