import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const syncWithPanel = async (currentSession: Session) => {
    const userId = currentSession.user.id;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('pterodactyl_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile?.pterodactyl_id) {
        console.log('Registering panel user...');
        const { data, error } = await supabase.functions.invoke('pterodactyl-api', {
          body: {
            action: 'register_panel_user',
            email: currentSession.user.email,
            username: currentSession.user.email?.split('@')[0],
            password: crypto.randomUUID(),
          },
        });
        console.log('Panel registration result:', data, error);
      }
    } catch (err) {
      console.warn('Panel registration failed:', err);
    }

    try {
      console.log('Syncing admin status...');
      const { data, error } = await supabase.functions.invoke('pterodactyl-api', {
        body: { action: 'sync_admin_status' },
      });
      console.log('Admin sync result:', data, error);

      // Invalidate user_roles query so UI updates
      queryClient.invalidateQueries({ queryKey: ['user_roles', userId] });
    } catch (err) {
      console.warn('Admin sync failed:', err);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN' && session) {
        setTimeout(() => syncWithPanel(session), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session) {
        setTimeout(() => syncWithPanel(session), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setSession(null);
    setUser(null);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
