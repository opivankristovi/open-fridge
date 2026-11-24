import type { CategoryKey } from './categories';
import type { LocationKind } from './locations';

export type Shelf = { fresh: number; opened: number | null };

/** Per-category override. A missing `opened` key means "not overridden"; an explicit null means "tot datum op verpakking". */
export type CategoryOverride = { fresh?: number; opened?: number | null };
export type CategoryOverrides = Partial<Record<CategoryKey, CategoryOverride>>;
export type ShelfOverrides = Partial<Record<LocationKind, CategoryOverrides>>;

const s = (fresh: number, opened: number | null): Shelf => ({ fresh, opened });

/**
 * Built-in shelf life per location kind and category.
 * fresh: days for a product WITHOUT package/printed date, counted from when it was stored;
 * opened: days after opening a store-bought package; null = until the date printed on the package.
 */
export const SHELF_BASE: Record<LocationKind, Record<CategoryKey, Shelf>> = {
  fridge: {
    groenten: s(5, 2), fruit: s(5, 3), vlees: s(2, 3), vis: s(1, 2), zuivel: s(5, 4),
    kaas: s(7, 14), restjes: s(3, null), sauzen: s(5, null), dranken: s(2, 4),
    droogwaren: s(90, 30), conserven: s(3, 4), brood: s(5, 5), maaltijden: s(3, 2),
    snacks: s(14, 7), overig: s(3, 4),
  },
  freezer: {
    groenten: s(240, 180), fruit: s(240, 180), vlees: s(120, 90), vis: s(90, 60), zuivel: s(90, 60),
    kaas: s(120, 90), restjes: s(90, null), sauzen: s(90, 90), dranken: s(90, 60),
    droogwaren: s(365, 180), conserven: s(90, 60), brood: s(90, 60), maaltijden: s(90, 60),
    snacks: s(90, 60), overig: s(90, 60),
  },
  pantry: {
    groenten: s(7, 2), fruit: s(5, 3), vlees: s(1, 1), vis: s(1, 1), zuivel: s(1, 1),
    kaas: s(2, 1), restjes: s(1, null), sauzen: s(30, null), dranken: s(3, 3),
    droogwaren: s(365, 180), conserven: s(365, 1), brood: s(3, 3), maaltijden: s(1, 1),
    snacks: s(30, 14), overig: s(30, 14),
  },
  cellar: {
    groenten: s(14, 3), fruit: s(14, 3), vlees: s(1, 1), vis: s(1, 1), zuivel: s(2, 1),
    kaas: s(7, 5), restjes: s(1, null), sauzen: s(60, null), dranken: s(30, 3),
    droogwaren: s(365, 180), conserven: s(365, 1), brood: s(3, 3), maaltijden: s(1, 1),
    snacks: s(60, 14), overig: s(60, 14),
  },
  storage_room: {
    groenten: s(7, 2), fruit: s(5, 3), vlees: s(1, 1), vis: s(1, 1), zuivel: s(1, 1),
    kaas: s(2, 1), restjes: s(1, null), sauzen: s(30, null), dranken: s(3, 3),
    droogwaren: s(365, 180), conserven: s(365, 1), brood: s(3, 3), maaltijden: s(1, 1),
    snacks: s(30, 14), overig: s(30, 14),
  },
  other: {
    groenten: s(7, 2), fruit: s(5, 3), vlees: s(1, 1), vis: s(1, 1), zuivel: s(1, 1),
    kaas: s(2, 1), restjes: s(1, null), sauzen: s(30, null), dranken: s(3, 3),
    droogwaren: s(365, 180), conserven: s(365, 1), brood: s(3, 3), maaltijden: s(1, 1),
    snacks: s(30, 14), overig: s(30, 14),
  },
};

export function shelfDefaults(
  kind: LocationKind,
  cat: CategoryKey,
  overrides?: ShelfOverrides | null,
): Shelf {
  const base = SHELF_BASE[kind][cat];
  const o = overrides?.[kind]?.[cat];
  return {
    fresh: o?.fresh ?? base.fresh,
    opened: o && 'opened' in o && o.opened !== undefined ? o.opened : base.opened,
  };
}
