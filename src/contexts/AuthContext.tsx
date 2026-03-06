import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Fire-and-forget panel sync on sign-in (no await to prevent deadlocks)
      if (event === 'SIGNED_IN' && session) {
        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('pterodactyl_id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profile?.pterodactyl_id) {
              await supabase.functions.invoke('pterodactyl-api', {
                body: {
                  action: 'register_panel_user',
                  email: session.user.email,
                  username: session.user.email?.split('@')[0],
                  password: crypto.randomUUID(),
                },
              });
            }
          } catch (err) {
            console.warn('Panel registration failed:', err);
          }

          try {
            await supabase.functions.invoke('pterodactyl-api', {
              body: { action: 'sync_admin_status' },
            });
          } catch (err) {
            console.warn('Admin sync failed:', err);
          }
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Clear state first to ensure UI updates immediately
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
