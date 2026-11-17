import { supabase } from '../lib/supabase';
import type { HouseholdMember, MyMembership } from '../types/db';

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
