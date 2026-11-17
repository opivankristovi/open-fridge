import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getPrefs } from '../data/localPrefs';
import { listInFridge } from '../data/itemsRepo';
import { buildSchedule } from './schedule';

export { buildSchedule } from './schedule';
export type { ScheduledEntry } from './schedule';

const CHANNEL_ID = 'expiry';

/** Household whose items are scheduled; set by the tabs layout. */
let currentHid: string | null = null;
export function setCurrentHousehold(hid: string | null) {
  currentHid = hid;
}

export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Houdbaarheid',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain && p.status === 'undetermined' ? 'undetermined' : 'denied';
}

/** Asks for permission if it was not granted yet. Returns whether notifications are allowed. */
export async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

async function doResync(hid: string): Promise<void> {
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) return;
  const [prefs, items] = await Promise.all([getPrefs(), listInFridge(hid)]);
  const entries = buildSchedule(items, prefs, new Date());
  // Only cancel expiry notifications (they carry an itemId), so e.g. a pending
  // test notification survives a resync.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => typeof n.content.data?.itemId === 'string')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  for (const e of entries) {
    await Notifications.scheduleNotificationAsync({
      content: { title: e.title, body: e.body, data: e.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: e.date, channelId: CHANNEL_ID },
    });
  }
}

// Runs are serialised so that two overlapping resyncs can never double-schedule.
let queue: Promise<void> = Promise.resolve();

export function resyncAll(hid: string): Promise<void> {
  queue = queue.then(() => doResync(hid)).catch(() => undefined);
  return queue;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced (2 s) resync for the current household. */
export function requestResync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (currentHid) void resyncAll(currentHid);
  }, 2000);
}

export async function cancelAllNotifications(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  currentHid = null;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // nothing to cancel / unsupported
  }
}

/** Schedules a notification 5 seconds from now. Returns false without permission. */
export async function sendTestNotification(title: string, body: string): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

/** Resync when mounted and every time the app returns to the foreground. */
export function useResyncOnActive(hid: string | null) {
  useEffect(() => {
    if (!hid) return;
    void resyncAll(hid);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void resyncAll(hid);
    });
    return () => sub.remove();
  }, [hid]);
}

/** Opens the item when a notification is tapped (also from a cold start). */
export function useNotificationTapRouting() {
  useEffect(() => {
    let alive = true;
    const open = (response: Notifications.NotificationResponse | null) => {
      const itemId = response?.notification.request.content.data?.itemId;
      if (typeof itemId !== 'string') return;
      router.push({ pathname: '/item/[id]', params: { id: itemId } });
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (alive) open(r);
      })
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
}
