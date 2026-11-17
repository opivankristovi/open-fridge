import { supabase } from '../lib/supabase';
import type { CategoryKey, HouseholdProduct } from '../types/db';

export async function getProduct(hid: string, barcode: string): Promise<HouseholdProduct | null> {
  const { data, error } = await supabase
    .from('household_products')
    .select('*')
    .eq('household_id', hid)
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw error;
  return (data as HouseholdProduct | null) ?? null;
}

export type ProductInput = {
  household_id: string;
  barcode: string;
  name: string;
  brand?: string | null;
  image_url?: string | null;
  category: CategoryKey;
  /** Omit to keep the stored value. */
  last_opened_shelf_days?: number | null;
};

export async function upsertProduct(input: ProductInput): Promise<void> {
  const { error } = await supabase
    .from('household_products')
    .upsert(input, { onConflict: 'household_id,barcode' });
  if (error) throw error;
}

export async function setProductOpenedDays(hid: string, barcode: string, days: number): Promise<void> {
  const { error } = await supabase
    .from('household_products')
    .update({ last_opened_shelf_days: days })
    .eq('household_id', hid)
    .eq('barcode', barcode);
  if (error) throw error;
}
