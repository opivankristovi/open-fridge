import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { t } from '../i18n';
import { getPrefs } from '../data/localPrefs';
import { listInStock } from '../data/itemsRepo';
import { listLocations } from '../data/locationsRepo';
import { locationLabel } from '../domain/locations';
import { buildSchedule, entryId, planResync } from './schedule';

export { buildSchedule } from './schedule';
export type { ScheduledEntry } from './schedule';

const CHANNEL_ID = 'expiry';
const EXACT_KEY = 'notifications.exact.v1';

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
    name: t.notifications.channel,
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
  const exact = await getExactAlarmStatus();
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(EXACT_KEY);
  } catch {
    // treat as unknown: rebuild everything
  }
  const forceAll = stored !== (exact ? '1' : '0');

  const now = new Date();
  const [prefs, items, locations] = await Promise.all([
    getPrefs(),
    listInStock(hid),
    listLocations(hid),
  ]);
  // With several locations, say where the product is in the notification text.
  const byId = new Map(locations.map((l) => [l.id, l]));
  const named =
    locations.length >= 2
      ? items.map((item) => {
          const loc = item.location_id ? byId.get(item.location_id) : undefined;
          return loc ? { ...item, name: t.notifications.withLocation(item.name, locationLabel(loc)) } : item;
        })
      : items;
  const entries = buildSchedule(named, prefs, now);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  // Legacy cleanup: the old app version used random ids; those carry an itemId.
  const legacy = scheduled.filter(
    (n) => typeof n.content.data?.itemId === 'string' && !n.identifier.startsWith('item:'),
  );
  await Promise.all(legacy.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const legacyIds = new Set(legacy.map((n) => n.identifier));

  const plan = planResync(
    scheduled.map((n) => n.identifier).filter((id) => !legacyIds.has(id)),
    entries,
    new Set(items.map((i) => i.id)),
    now,
    forceAll,
  );
  await Promise.all(plan.cancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  for (const e of plan.schedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: entryId(e),
      content: { title: e.title, body: e.body, data: e.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: e.date, channelId: CHANNEL_ID },
    });
  }
  try {
    await AsyncStorage.setItem(EXACT_KEY, exact ? '1' : '0');
  } catch {
    // best effort
  }
}

/** Whether Android lets us schedule exact alarms. True on errors and non-Android. */
export async function getExactAlarmStatus(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true;
  }
}

/** Opens the system screen for exact alarms. Returns whether it is granted afterwards. */
export async function requestExactAlarms(): Promise<boolean> {
  let granted = false;
  try {
    granted = (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    // manifest without the permission / unsupported
  }
  requestResync();
  return granted;
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

/** Schedules a notification 60 seconds from now (same path as real reminders). Returns false without permission. */
export async function sendTestNotification(title: string, body: string): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 60_000),
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
