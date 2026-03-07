import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const SYNC_INTERVAL_MS = 60_000; // 60 seconds

export const useAdminSync = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  const syncAdminStatus = useCallback(async () => {
    if (!user || !session || syncingRef.current) return;
    syncingRef.current = true;

    try {
      // First ensure user has a panel account
      const { data: profile } = await supabase
        .from('profiles')
        .select('pterodactyl_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.pterodactyl_id) {
        console.log('[AdminSync] No pterodactyl_id, registering panel user...');
        const { data, error } = await supabase.functions.invoke('pterodactyl-api', {
          body: {
            action: 'register_panel_user',
            email: user.email,
            username: user.email?.split('@')[0],
            password: crypto.randomUUID(),
          },
        });
        if (error) console.warn('[AdminSync] Panel registration error:', error);
        else console.log('[AdminSync] Panel registration result:', data);
      }

      // Sync admin status
      console.log('[AdminSync] Syncing admin status...');
      const { data, error } = await supabase.functions.invoke('pterodactyl-api', {
        body: { action: 'sync_admin_status' },
      });

      if (error) {
        console.warn('[AdminSync] Sync error:', error);
      } else {
        console.log('[AdminSync] Sync result:', data);
        // Invalidate queries so UI updates immediately
        queryClient.invalidateQueries({ queryKey: ['user_roles', user.id] });
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      }
    } catch (err) {
      console.warn('[AdminSync] Failed:', err);
    } finally {
      syncingRef.current = false;
    }
  }, [user, session, queryClient]);

  // Auto-sync on mount and every SYNC_INTERVAL_MS
  useEffect(() => {
    if (!user || !session) return;

    // Sync immediately
    syncAdminStatus();

    // Then periodically
    const interval = setInterval(syncAdminStatus, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, session, syncAdminStatus]);

  return { syncAdminStatus, isSyncing: syncingRef.current };
};
