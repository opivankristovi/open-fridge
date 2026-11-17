import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type Prefs = { warnDays: number; notifyHour: number };

export const DEFAULT_PREFS: Prefs = { warnDays: 2, notifyHour: 9 };

const KEY = 'prefs.v1';

let cache: Prefs | null = null;
const listeners = new Set<(p: Prefs) => void>();

export async function getPrefs(): Promise<Prefs> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
    cache = {
      warnDays: typeof parsed.warnDays === 'number' ? parsed.warnDays : DEFAULT_PREFS.warnDays,
      notifyHour: typeof parsed.notifyHour === 'number' ? parsed.notifyHour : DEFAULT_PREFS.notifyHour,
    };
  } catch {
    cache = { ...DEFAULT_PREFS };
  }
  return cache;
}

export async function setPrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await getPrefs()), ...patch };
  cache = next;
  listeners.forEach((l) => l(next));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // keep the in-memory value
  }
  return next;
}

export function usePrefs(): {
  prefs: Prefs;
  loaded: boolean;
  update: (patch: Partial<Prefs>) => Promise<Prefs>;
} {
  const [prefs, setState] = useState<Prefs>(cache ?? DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(cache !== null);

  useEffect(() => {
    let alive = true;
    getPrefs().then((p) => {
      if (alive) {
        setState(p);
        setLoaded(true);
      }
    });
    const listener = (p: Prefs) => setState(p);
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => setPrefs(patch), []);
  return { prefs, loaded, update };
}
