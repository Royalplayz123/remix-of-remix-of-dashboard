import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const callPteroAPI = async (action: string, params: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke('pterodactyl-api', {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};

export const usePteroLocations = () => {
  return useQuery({
    queryKey: ['ptero_locations'],
    queryFn: () => callPteroAPI('list_locations'),
    staleTime: 5 * 60 * 1000,
  });
};

export const usePteroNodes = () => {
  return useQuery({
    queryKey: ['ptero_nodes'],
    queryFn: () => callPteroAPI('list_nodes'),
    staleTime: 5 * 60 * 1000,
  });
};

export const usePteroNests = () => {
  return useQuery({
    queryKey: ['ptero_nests'],
    queryFn: () => callPteroAPI('list_nests'),
    staleTime: 5 * 60 * 1000,
  });
};

export const usePteroEggs = (nestId: number | null) => {
  return useQuery({
    queryKey: ['ptero_eggs', nestId],
    queryFn: () => callPteroAPI('list_eggs', { nest_id: nestId }),
    enabled: !!nestId,
    staleTime: 5 * 60 * 1000,
  });
};

export const usePteroServers = (enabled = true) => {
  return useQuery({
    queryKey: ['ptero_servers'],
    queryFn: () => callPteroAPI('list_servers'),
    enabled,
    refetchInterval: 30000,
  });
};

export const usePteroUsers = (enabled = true) => {
  return useQuery({
    queryKey: ['ptero_users'],
    queryFn: () => callPteroAPI('list_users'),
    enabled,
    staleTime: 30000,
  });
};

export const useCreatePteroServer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => callPteroAPI('create_server', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptero_servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server created successfully!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useDeletePteroServer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serverId: number) => callPteroAPI('delete_server', { server_id: serverId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptero_servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server deleted!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useServerPower = () => {
  return useMutation({
    mutationFn: ({ identifier, signal }: { identifier: string; signal: string }) =>
      callPteroAPI('server_power', { server_identifier: identifier, signal }),
    onSuccess: (_, { signal }) => {
      toast.success(`Server ${signal} signal sent!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useSuspendServer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serverId: number) => callPteroAPI('suspend_server', { server_id: serverId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptero_servers'] });
      toast.success('Server suspended!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useUnsuspendServer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serverId: number) => callPteroAPI('unsuspend_server', { server_id: serverId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptero_servers'] });
      toast.success('Server unsuspended!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useUpdateServerBuild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => callPteroAPI('update_server_build', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptero_servers'] });
      toast.success('Server updated!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useCreatePteroUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => callPteroAPI('create_user', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptero_users'] });
      toast.success('User created on panel!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useDeletePteroUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pteroUserId: number) => callPteroAPI('delete_user', { ptero_user_id: pteroUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ptero_users'] });
      toast.success('User deleted from panel!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export { callPteroAPI };
