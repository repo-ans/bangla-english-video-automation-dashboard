import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSession } from './useSession';

export function useProfile() {
  const { user } = useSession();

  return useQuery({
    queryKey: ['profile', user?.id, api.getDemoRole?.()],
    queryFn: () => api.getProfile(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
}
