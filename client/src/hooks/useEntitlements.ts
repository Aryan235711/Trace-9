import { useMemo } from 'react';
import { ENTITLEMENTS, PlanId } from '@/lib/entitlements';
import { useAuth } from './useAuth';

export function useEntitlements() {
  const { user } = useAuth();
  const plan: PlanId = (user?.plan as PlanId) || 'free';

  const entitlements = useMemo(() => ENTITLEMENTS[plan], [plan]);
  return { plan, entitlements, isPro: plan === 'pro' };
}
