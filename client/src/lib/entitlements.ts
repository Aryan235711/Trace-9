export type PlanId = 'free' | 'pro';

export type Entitlements = {
  historyDays: number;
  canViewInsights: boolean;
  canCreateInterventions: boolean;
  canExport: boolean;
  canUseAdvancedNotifications: boolean;
};

export const ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free: {
    historyDays: 14,
    canViewInsights: false,
    canCreateInterventions: false,
    canExport: false,
    canUseAdvancedNotifications: false,
  },
  pro: {
    historyDays: 90,
    canViewInsights: true,
    canCreateInterventions: true,
    canExport: true,
    canUseAdvancedNotifications: true,
  },
};