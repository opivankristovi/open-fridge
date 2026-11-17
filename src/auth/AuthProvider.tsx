import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getMyMembership } from '../data/householdRepo';
import { queryClient } from '../lib/queryClient';
import { supabase } from '../lib/supabase';

export type HouseholdInfo = { id: string; name: string; invite_code: string };
export type MembershipInfo = {
  household_id: string;
  display_name: string;
  role: 'owner' | 'member';
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  household: HouseholdInfo | null;
  membership: MembershipInfo | null;
  refreshHousehold: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);

  const loadHousehold = useCallback(async () => {
    try {
      const m = await getMyMembership();
      if (m && m.households) {
        setHousehold({ id: m.households.id, name: m.households.name, invite_code: m.households.invite_code });
        setMembership({ household_id: m.household_id, display_name: m.display_name, role: m.role });
      } else {
        setHousehold(null);
        setMembership(null);
      }
    } catch {
      setHousehold(null);
      setMembership(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSessionLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setHousehold(null);
      setMembership(null);
      setLoadedFor(null);
      return;
    }
    loadHousehold().finally(() => {
      if (!cancelled) setLoadedFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, loadHousehold]);

  const refreshHousehold = useCallback(async () => {
    await loadHousehold();
  }, [loadHousehold]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading: sessionLoading || (userId !== null && loadedFor !== userId),
      household,
      membership,
      refreshHousehold,
      signOut,
    }),
    [session, sessionLoading, userId, loadedFor, household, membership, refreshHousehold, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth moet binnen een AuthProvider gebruikt worden');
  return ctx;
}
