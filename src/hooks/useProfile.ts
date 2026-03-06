import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useUserResources = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user_resources', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_resources')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useServers = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['servers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
};

export const useUserRoles = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user_roles', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
};

export const useIsAdmin = () => {
  const { data: roles } = useUserRoles();
  return roles?.some((r: any) => r.role === 'admin') ?? false;
};
