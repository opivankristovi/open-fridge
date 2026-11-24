import { t } from '../i18n/strings';

export type CategoryKey =
  | 'groenten' | 'fruit' | 'vlees' | 'vis' | 'zuivel'
  | 'kaas' | 'restjes' | 'sauzen' | 'dranken' | 'overig';

export type CategoryInfo = {
  /** Ionicons name */
  icon: string;
  /** days in fridge for a product WITHOUT package/printed date, counted from when it went in */
  fresh: number;
  /** days after opening a store-bought package; null = until the date printed on the package */
  opened: number | null;
  /** false for things that are never "opened" (leftovers) */
  canOpen: boolean;
};

export const CATEGORIES: Record<CategoryKey, CategoryInfo> = {
  groenten: { icon: 'leaf-outline', fresh: 5, opened: 2, canOpen: true },
  fruit: { icon: 'nutrition-outline', fresh: 5, opened: 3, canOpen: true },
  vlees: { icon: 'restaurant-outline', fresh: 2, opened: 3, canOpen: true },
  vis: { icon: 'fish-outline', fresh: 1, opened: 2, canOpen: true },
  zuivel: { icon: 'water-outline', fresh: 5, opened: 4, canOpen: true },
  kaas: { icon: 'pie-chart-outline', fresh: 7, opened: 14, canOpen: true },
  restjes: { icon: 'cafe-outline', fresh: 3, opened: null, canOpen: false },
  sauzen: { icon: 'flask-outline', fresh: 5, opened: null, canOpen: true },
  dranken: { icon: 'beer-outline', fresh: 2, opened: 4, canOpen: true },
  overig: { icon: 'cube-outline', fresh: 3, opened: 4, canOpen: true },
};

/** Per-category override. A missing `opened` key means "not overridden"; an explicit null means "tot datum op verpakking". */
export type CategoryOverride = { fresh?: number; opened?: number | null };
export type CategoryOverrides = Partial<Record<CategoryKey, CategoryOverride>>;

export function shelfDefaults(
  cat: CategoryKey,
  overrides?: CategoryOverrides | null,
): { fresh: number; opened: number | null } {
  const base = CATEGORIES[cat];
  const o = overrides?.[cat];
  return {
    fresh: o?.fresh ?? base.fresh,
    opened: o && 'opened' in o && o.opened !== undefined ? o.opened : base.opened,
  };
}

/** Map Open Food Facts categories_tags to a CategoryKey. Cheese beats dairy. */
export function categoryFromOff(tags: string[]): CategoryKey {
  const tagSet = new Set((tags ?? []).map((x) => x.toLowerCase()));
  const has = (...keys: string[]) => keys.some((k) => tagSet.has(k));
  if (has('en:cheeses')) return 'kaas';
  if (has('en:fishes', 'en:seafood', 'en:fish-and-seafood')) return 'vis';
  if (has('en:meats', 'en:meats-and-their-products', 'en:poultry')) return 'vlees';
  if (has('en:dairies', 'en:milks', 'en:yogurts', 'en:fermented-milk-products', 'en:dairy-desserts')) return 'zuivel';
  if (has('en:vegetables', 'en:fresh-vegetables', 'en:vegetables-based-foods')) return 'groenten';
  if (has('en:fruits', 'en:fresh-fruits', 'en:fruits-and-vegetables-based-foods')) return 'fruit';
  if (has('en:sauces', 'en:condiments', 'en:dressings')) return 'sauzen';
  if (has('en:beverages', 'en:juices', 'en:waters')) return 'dranken';
  return 'overig';
}

export function categoryLabel(cat: CategoryKey): string {
  return t.categories[cat];
}
