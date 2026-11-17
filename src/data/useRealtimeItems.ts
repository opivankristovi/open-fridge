import { useEffect } from 'react';

import { queryClient } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { requestResync } from '../services/notifications';

export function useRealtimeItems(hid: string | null | undefined) {
  useEffect(() => {
    if (!hid) return;
    const channel = supabase
      .channel(`items:${hid}`)
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
