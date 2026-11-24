import { randomUUID } from 'expo-crypto';

import { supabase } from '../lib/supabase';
import type { CategoryKey, Item } from '../types/db';

/** Columns a client may write on UPDATE (see column grants in 0001_init.sql). */
export type ItemPatch = Partial<
  Pick<
    Item,
    | 'name'
    | 'brand'
    | 'barcode'
    | 'photo_path'
    | 'image_url'
    | 'category'
    | 'quantity'
    | 'added_at'
    | 'location_id'
    | 'stored_at'
    | 'expiry_date'
    | 'opened_at'
    | 'opened_shelf_days'
    | 'fresh_shelf_days'
    | 'status'
    | 'removed_at'
    | 'removed_by'
  >
>;

export type NewItemInput = {
  /** Optional: lets the caller upload a photo under the item id before inserting. */
  id?: string;
  household_id: string;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  photo_path?: string | null;
  image_url?: string | null;
  category: CategoryKey;
  location_id: string;
  /** Defaults to now() in the database. */
  stored_at?: string;
  quantity?: number;
  expiry_date?: string | null;
  opened_at?: string | null;
  opened_shelf_days?: number | null;
  fresh_shelf_days?: number | null;
};

export async function listInStock(hid: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('household_id', hid)
    .eq('status', 'in_fridge')
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function listRemovedSince(hid: string, sinceIso: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('household_id', hid)
    .in('status', ['consumed', 'discarded'])
    .gte('removed_at', sinceIso)
    .order('removed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function getItem(id: string): Promise<Item | null> {
  const { data, error } = await supabase.from('items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Item | null) ?? null;
}

export async function createItem(input: NewItemInput): Promise<Item> {
  // added_by is filled by the DB default (auth.uid()).
  const row = { ...input, id: input.id ?? randomUUID() };
  const { data, error } = await supabase.from('items').insert(row).select('*').single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(id: string, patch: ItemPatch): Promise<Item> {
  const { data, error } = await supabase.from('items').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Item;
}

/** Move an item to another location (and optionally restart its shelf-life clock). */
export async function moveItem(
  id: string,
  patch: Pick<ItemPatch, 'location_id' | 'stored_at' | 'expiry_date' | 'fresh_shelf_days' | 'opened_shelf_days'>,
): Promise<Item> {
  return updateItem(id, patch);
}

export async function markOpened(id: string, shelfDays: number | null): Promise<Item> {
  return updateItem(id, { opened_at: new Date().toISOString(), opened_shelf_days: shelfDays });
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function removeItem(id: string, status: 'consumed' | 'discarded'): Promise<Item> {
  return updateItem(id, {
    status,
    removed_at: new Date().toISOString(),
    removed_by: await currentUserId(),
  });
}

export async function restoreItem(id: string): Promise<Item> {
  return updateItem(id, { status: 'in_fridge', removed_at: null, removed_by: null });
}

export async function deleteItem(item: Pick<Item, 'id' | 'photo_path'>): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', item.id);
  if (error) throw error;
  if (item.photo_path) {
    // Best effort: the row is already gone, an orphaned photo is not worth failing for.
    await supabase.storage
      .from('photos')
      .remove([item.photo_path])
      .catch(() => undefined);
  }
}
