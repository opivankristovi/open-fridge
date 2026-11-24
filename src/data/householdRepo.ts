import type { ShelfOverrides } from '../domain/shelfLife';
import { supabase } from '../lib/supabase';
import type { HouseholdMember, HouseholdSettings, MyMembership } from '../types/db';

/** The user's active household is their first membership (by joined_at). */
export async function getMyMembership(): Promise<MyMembership | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, display_name, role, households(id,name,invite_code)')
    .eq('user_id', uid)
    .order('joined_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  const row = (data?.[0] ?? null) as unknown as MyMembership | null;
  return row;
}

export async function createHousehold(name: string, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_household', {
    p_name: name.trim(),
    p_display_name: displayName.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function joinHousehold(code: string, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_household', {
    p_code: code.trim().toUpperCase(),
    p_display_name: displayName.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function listMembers(householdId: string): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, user_id, display_name, role, joined_at')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HouseholdMember[];
}

export async function getHouseholdSettings(householdId: string): Promise<HouseholdSettings | null> {
  const { data, error } = await supabase
    .from('household_settings')
    .select('household_id, shelf_defaults')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  return (data as HouseholdSettings | null) ?? null;
}

export async function updateShelfDefaults(
  householdId: string,
  shelf: ShelfOverrides,
): Promise<void> {
  const { error } = await supabase
    .from('household_settings')
    .update({ shelf_defaults: shelf })
    .eq('household_id', householdId);
  if (error) throw error;
}

export async function regenerateInviteCode(householdId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_invite_code', { p_household_id: householdId });
  if (error) throw error;
  return data as string;
}
