import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // On sign-in, register on panel if needed and sync admin status
      if (event === 'SIGNED_IN' && session) {
        try {
          // Check if user already has a pterodactyl_id
          const { data: profile } = await supabase
            .from('profiles')
            .select('pterodactyl_id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!profile?.pterodactyl_id) {
            // Register on panel for new users (including OAuth)
            await supabase.functions.invoke('pterodactyl-api', {
              body: {
                action: 'register_panel_user',
                email: session.user.email,
                username: session.user.email?.split('@')[0],
                password: crypto.randomUUID(), // random password for OAuth users
              },
            });
          }

          // Always sync admin status
          await supabase.functions.invoke('pterodactyl-api', {
            body: { action: 'sync_admin_status' },
          });
        } catch (err) {
          console.warn('Panel sync failed:', err);
        }
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
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
