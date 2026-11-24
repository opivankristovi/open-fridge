import { t } from '../i18n/strings';

export type CategoryKey =
  | 'groenten' | 'fruit' | 'vlees' | 'vis' | 'zuivel'
  | 'kaas' | 'restjes' | 'sauzen' | 'dranken' | 'overig'
  | 'droogwaren' | 'conserven' | 'brood' | 'maaltijden' | 'snacks';

export type CategoryInfo = {
  /** Ionicons name */
  icon: string;
  /** false for things that are never "opened" (leftovers) */
  canOpen: boolean;
};

/** Order = order of the category chips ("overig" last). Shelf life lives in shelfLife.ts. */
export const CATEGORIES: Record<CategoryKey, CategoryInfo> = {
  groenten: { icon: 'leaf-outline', canOpen: true },
  fruit: { icon: 'nutrition-outline', canOpen: true },
  vlees: { icon: 'restaurant-outline', canOpen: true },
  vis: { icon: 'fish-outline', canOpen: true },
  zuivel: { icon: 'water-outline', canOpen: true },
  kaas: { icon: 'pie-chart-outline', canOpen: true },
  restjes: { icon: 'cafe-outline', canOpen: false },
  sauzen: { icon: 'flask-outline', canOpen: true },
  dranken: { icon: 'beer-outline', canOpen: true },
  droogwaren: { icon: 'basket-outline', canOpen: true },
  conserven: { icon: 'archive-outline', canOpen: true },
  brood: { icon: 'bag-handle-outline', canOpen: true },
  maaltijden: { icon: 'fast-food-outline', canOpen: true },
  snacks: { icon: 'ice-cream-outline', canOpen: true },
  overig: { icon: 'cube-outline', canOpen: true },
};

export type { CategoryOverride, CategoryOverrides } from './shelfLife';

/** Map Open Food Facts categories_tags to a CategoryKey. Cheese beats dairy. */
export function categoryFromOff(tags: string[]): CategoryKey {
  const tagSet = new Set((tags ?? []).map((x) => x.toLowerCase()));
  const has = (...keys: string[]) => keys.some((k) => tagSet.has(k));
  if (has('en:cheeses')) return 'kaas';
  if (has('en:canned-foods', 'en:canned-vegetables', 'en:canned-fish', 'en:jams', 'en:pickles')) return 'conserven';
  if (has('en:meals', 'en:prepared-meals', 'en:frozen-ready-meals', 'en:pizzas')) return 'maaltijden';
  if (has('en:fishes', 'en:seafood', 'en:fish-and-seafood')) return 'vis';
  if (has('en:meats', 'en:meats-and-their-products', 'en:poultry')) return 'vlees';
  if (has('en:dairies', 'en:milks', 'en:yogurts', 'en:fermented-milk-products', 'en:dairy-desserts')) return 'zuivel';
  if (has('en:breads', 'en:viennoiseries', 'en:cakes', 'en:pastries')) return 'brood';
  if (has('en:pastas', 'en:rices', 'en:flours', 'en:breakfast-cereals', 'en:dried-products', 'en:legumes-and-their-products')) return 'droogwaren';
  if (has('en:snacks', 'en:sweet-snacks', 'en:salty-snacks', 'en:chocolates', 'en:confectioneries', 'en:biscuits', 'en:ice-creams')) return 'snacks';
  if (has('en:vegetables', 'en:fresh-vegetables', 'en:vegetables-based-foods')) return 'groenten';
  if (has('en:fruits', 'en:fresh-fruits', 'en:fruits-and-vegetables-based-foods')) return 'fruit';
  if (has('en:sauces', 'en:condiments', 'en:dressings')) return 'sauzen';
  if (has('en:beverages', 'en:juices', 'en:waters')) return 'dranken';
  return 'overig';
}

export function categoryLabel(cat: CategoryKey): string {
  return t.categories[cat];
}
