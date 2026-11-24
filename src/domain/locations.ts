import { t } from '../i18n/strings';
import type { StorageLocation } from '../types/db';

export type LocationKind = 'fridge' | 'freezer' | 'pantry' | 'cellar' | 'storage_room' | 'other';

export const LOCATION_KINDS: readonly LocationKind[] = [
  'fridge',
  'freezer',
  'pantry',
  'cellar',
  'storage_room',
  'other',
];

/** Ionicons names */
export const KIND_ICONS: Record<LocationKind, string> = {
  fridge: 'thermometer-outline',
  freezer: 'snow-outline',
  pantry: 'file-tray-stacked-outline',
  cellar: 'wine-outline',
  storage_room: 'cube-outline',
  other: 'location-outline',
};

export function kindLabel(kind: LocationKind): string {
  return t.locations.kinds[kind];
}

/** The location's own name, or the translated kind label when it has none. */
export function locationLabel(l: Pick<StorageLocation, 'name' | 'kind'>): string {
  return l.name?.trim() || kindLabel(l.kind);
}

/** By kind (LOCATION_KINDS order), then oldest first. Returns a new array. */
export function sortLocations<T extends Pick<StorageLocation, 'kind' | 'created_at'>>(ls: T[]): T[] {
  return [...ls].sort(
    (a, b) =>
      LOCATION_KINDS.indexOf(a.kind) - LOCATION_KINDS.indexOf(b.kind) ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/** Oldest fridge, else the oldest location (mirrors default_location() in the database). */
export function defaultLocation<T extends Pick<StorageLocation, 'id' | 'kind' | 'created_at'>>(
  ls: T[],
): T | null {
  let best: T | null = null;
  for (const l of ls) {
    if (!best) {
      best = l;
      continue;
    }
    const lf = l.kind === 'fridge';
    const bf = best.kind === 'fridge';
    if (lf !== bf) {
      if (lf) best = l;
    } else if (new Date(l.created_at).getTime() < new Date(best.created_at).getTime()) {
      best = l;
    }
  }
  return best;
}
