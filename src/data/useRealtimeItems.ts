import { useEffect } from 'react';

import { queryClient } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { requestResync } from '../services/notifications';

// A fresh topic per subscription: when the tree remounts (e.g. after a language change)
// supabase.channel() would otherwise hand back the old, still-leaving channel and the
// new listener would be dropped once the leave completes.
let subscriptionSeq = 0;

export function useRealtimeItems(hid: string | null | undefined) {
  useEffect(() => {
    if (!hid) return;
    const channel = supabase
      .channel(`items:${hid}:${++subscriptionSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${hid}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['items', hid] });
          requestResync();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hid]);
}
