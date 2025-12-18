import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { ENTITLEMENTS, type PlanId, type Entitlements } from '@/lib/entitlements';

export function useEntitlements() {
  const { getAuthHeaders } = useAuth();

  const { data: plan = 'free' as PlanId, isLoading } = useQuery({
    queryKey: ['entitlements'],
    queryFn: async (): Promise<PlanId> => {
      try {
        const response = await fetch('/api/billing/plan', {
          headers: getAuthHeaders(),
        });
        if (!response.ok) return 'free';
        const data = await response.json();
        return data.plan || 'free';
      } catch {
        return 'free';
      }
    },
  });

  const entitlements: Entitlements = ENTITLEMENTS[plan];

  return {
    plan,
    entitlements,
    isLoading,
  };
}