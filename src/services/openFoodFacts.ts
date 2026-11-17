import { categoryFromOff } from '../domain/categories';
import type { CategoryKey } from '../types/db';

export type OffProduct = {
  name: string;
  brand: string | null;
  image_url: string | null;
  category: CategoryKey;
};

type OffResponse = {
  status?: number;
  product?: {
    product_name?: string;
    product_name_nl?: string;
    brands?: string;
    image_front_small_url?: string;
    image_front_url?: string;
    categories_tags?: string[];
  };
};

const clean = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');

/** Pure: turn an Open Food Facts v2 response into our product shape (or null). */
export function parseOffResponse(json: unknown): OffProduct | null {
  const res = json as OffResponse | null | undefined;
  if (!res || res.status !== 1 || !res.product) return null;
  const p = res.product;
  const name = clean(p.product_name_nl) || clean(p.product_name);
  if (!name) return null;
  const brand = clean(p.brands).split(',')[0]?.trim() || null;
  const image = p.image_front_url ?? p.image_front_small_url ?? null;
  const image_url = typeof image === 'string' && image.startsWith('https://') ? image : null;
  return {
    name,
    brand,
    image_url,
    category: categoryFromOff(Array.isArray(p.categories_tags) ? p.categories_tags : []),
  };
}

const FIELDS = 'product_name,product_name_nl,brands,image_front_small_url,image_front_url,categories_tags';

export async function lookupBarcode(code: string): Promise<OffProduct | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
      { headers: { 'User-Agent': 'OpenFridge/1.0 (Android)' }, signal: controller.signal },
    );
    if (!res.ok) return null;
    return parseOffResponse(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
