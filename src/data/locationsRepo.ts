import { sortLocations } from '../domain/locations';
import { supabase } from '../lib/supabase';
import type { LocationKind, StorageLocation } from '../types/db';

export async function listLocations(hid: string): Promise<StorageLocation[]> {
  const { data, error } = await supabase
    .from('storage_locations')
    .select('*')
    .eq('household_id', hid);
  if (error) throw error;
  return sortLocations((data ?? []) as StorageLocation[]);
}

export async function createLocation(input: {
  household_id: string;
  name: string | null;
  kind: LocationKind;
}): Promise<StorageLocation> {
  const { data, error } = await supabase
    .from('storage_locations')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as StorageLocation;
}

export async function updateLocation(
  id: string,
  patch: { name?: string | null; kind?: LocationKind },
): Promise<StorageLocation> {
  const { data, error } = await supabase
    .from('storage_locations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as StorageLocation;
}

/** Items still in stock in this location are moved to `moveTo` first (RPC). */
export async function deleteLocation(id: string, moveTo: string | null): Promise<void> {
  const { error } = await supabase.rpc('delete_storage_location', {
    p_location_id: id,
    p_move_to: moveTo,
  });
  if (error) throw error;
}
