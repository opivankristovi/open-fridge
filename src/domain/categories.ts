export type CategoryKey =
  | 'groenten' | 'fruit' | 'vlees' | 'vis' | 'zuivel'
  | 'kaas' | 'restjes' | 'sauzen' | 'dranken' | 'overig';

export type CategoryInfo = {
  label: string;
  /** Ionicons name */
  icon: string;
  /** days in fridge without printed date */
  fresh: number;
  /** days after opening */
  opened: number;
};

export const CATEGORIES: Record<CategoryKey, CategoryInfo> = {
  groenten: { label: 'Groenten', icon: 'leaf-outline', fresh: 5, opened: 3 },
  fruit: { label: 'Fruit', icon: 'nutrition-outline', fresh: 5, opened: 2 },
  vlees: { label: 'Vlees', icon: 'restaurant-outline', fresh: 2, opened: 2 },
  vis: { label: 'Vis', icon: 'fish-outline', fresh: 1, opened: 1 },
  zuivel: { label: 'Zuivel', icon: 'water-outline', fresh: 5, opened: 4 },
  kaas: { label: 'Kaas', icon: 'pie-chart-outline', fresh: 14, opened: 14 },
  restjes: { label: 'Restjes', icon: 'cafe-outline', fresh: 3, opened: 3 },
  sauzen: { label: 'Sauzen', icon: 'flask-outline', fresh: 30, opened: 30 },
  dranken: { label: 'Dranken', icon: 'beer-outline', fresh: 7, opened: 5 },
  overig: { label: 'Overig', icon: 'cube-outline', fresh: 4, opened: 4 },
};

export type CategoryOverrides = Partial<
  Record<CategoryKey, { fresh?: number; opened?: number }>
>;

export function shelfDefaults(
  cat: CategoryKey,
  overrides?: CategoryOverrides | null,
): { fresh: number; opened: number } {
  const base = CATEGORIES[cat];
  const o = overrides?.[cat];
  return { fresh: o?.fresh ?? base.fresh, opened: o?.opened ?? base.opened };
}

/** Map Open Food Facts categories_tags to a CategoryKey. Cheese beats dairy. */
export function categoryFromOff(tags: string[]): CategoryKey {
  const t = new Set((tags ?? []).map((x) => x.toLowerCase()));
  const has = (...keys: string[]) => keys.some((k) => t.has(k));
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
