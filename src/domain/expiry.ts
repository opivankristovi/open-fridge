import { addDays, differenceInCalendarDays, setHours, startOfDay, subDays } from 'date-fns';
import type { Item } from '../types/db';

export type ExpiryInput = Pick<
  Item,
  'added_at' | 'expiry_date' | 'opened_at' | 'opened_shelf_days' | 'fresh_shelf_days'
>;
export type ExpiryRule = 'printed' | 'opened' | 'fresh';
export type ExpiryStatus = 'verlopen' | 'bijna' | 'ok' | 'onbekend';

/** 'YYYY-MM-DD' -> local midnight (new Date(ymd) would parse as UTC). */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

const PRIORITY: Record<ExpiryRule, number> = { printed: 0, opened: 1, fresh: 2 };

export function effectiveExpiry(i: ExpiryInput): { date: Date; rule: ExpiryRule } | null {
  const candidates: { date: Date; rule: ExpiryRule }[] = [];
  if (i.expiry_date) {
    candidates.push({ date: parseLocalDate(i.expiry_date), rule: 'printed' });
  }
  if (i.opened_at && i.opened_shelf_days != null) {
    candidates.push({
      date: addDays(startOfDay(new Date(i.opened_at)), i.opened_shelf_days),
      rule: 'opened',
    });
  }
  if (!i.expiry_date && i.fresh_shelf_days != null) {
    candidates.push({
      date: addDays(startOfDay(new Date(i.added_at)), i.fresh_shelf_days),
      rule: 'fresh',
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || PRIORITY[a.rule] - PRIORITY[b.rule],
  );
  return candidates[0];
}

export function daysLeft(i: ExpiryInput, now: Date = new Date()): number | null {
  const e = effectiveExpiry(i);
  return e ? differenceInCalendarDays(e.date, now) : null;
}

export function expiryStatus(i: ExpiryInput, warnDays: number, now: Date = new Date()): ExpiryStatus {
  const d = daysLeft(i, now);
  if (d === null) return 'onbekend';
  if (d < 0) return 'verlopen';
  if (d <= warnDays) return 'bijna';
  return 'ok';
}

export function daysInFridge(i: ExpiryInput, now: Date = new Date()): number {
  return differenceInCalendarDays(now, new Date(i.added_at));
}

export function daysOpen(i: ExpiryInput, now: Date = new Date()): number | null {
  return i.opened_at ? differenceInCalendarDays(now, new Date(i.opened_at)) : null;
}

export function describeDaysLeft(n: number): string {
  if (n === 0) return 'vandaag laatste dag';
  if (n === 1) return 'nog 1 dag';
  if (n > 1) return `nog ${n} dagen`;
  if (n === -1) return '1 dag over datum';
  return `${-n} dagen over datum`;
}

export function notificationTriggers(
  i: ExpiryInput,
  warnDays: number,
  notifyHour: number,
  now: Date = new Date(),
): { date: Date; kind: 'warn' | 'expiry' }[] {
  const e = effectiveExpiry(i);
  if (!e) return [];
  const at = (d: Date) => setHours(startOfDay(d), notifyHour);
  const out: { date: Date; kind: 'warn' | 'expiry' }[] = [];
  if (warnDays > 0) out.push({ date: at(subDays(e.date, warnDays)), kind: 'warn' });
  out.push({ date: at(e.date), kind: 'expiry' });
  return out
    .filter((t) => t.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
