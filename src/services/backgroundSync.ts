import * as TaskManager from 'expo-task-manager';

import { getMyMembership } from '../data/householdRepo';
import { supabase } from '../lib/supabase';
import { resyncAll } from './notifications';

export const BACKGROUND_SYNC_TASK = 'fridge-resync';

// Mirrors expo-background-task's BackgroundTaskResult (loaded lazily, see below).
const RESULT_SUCCESS = 1;
const RESULT_FAILED = 2;

// Must run at module top level so the task exists when the OS wakes the app headlessly.
try {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return RESULT_SUCCESS;
      const membership = await getMyMembership();
      if (membership?.household_id) await resyncAll(membership.household_id);
      return RESULT_SUCCESS;
    } catch {
      return RESULT_FAILED;
    }
  });
} catch {
  // Task manager unavailable (e.g. unsupported runtime): background sync is optional.
}

/** Registers the periodic task. Never throws: unsupported in Expo Go and on some devices. */
export async function registerBackgroundSync(): Promise<void> {
  try {
    // Lazy require so a missing native module cannot crash app start.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundTask = require('expo-background-task') as typeof import('expo-background-task');
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return;
    // minimumInterval is in MINUTES (minimum 15).
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 12 * 60 });
  } catch {
    // ignore
  }
}
