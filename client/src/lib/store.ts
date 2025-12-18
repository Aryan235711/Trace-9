import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// UI state only - server state is managed by React Query
interface AppState {
  hasAcceptedDisclaimer: boolean;
  dismissedNotificationIds: string[];
  
  // Actions
  acceptDisclaimer: () => void;
  dismissNotification: (id: string) => void;
  clearDismissedNotifications: () => void;
  reset: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      hasAcceptedDisclaimer: false,
      dismissedNotificationIds: [],

      acceptDisclaimer: () => set({ hasAcceptedDisclaimer: true }),
      dismissNotification: (id: string) =>
        set((state) => ({
          dismissedNotificationIds: [...state.dismissedNotificationIds, id],
        })),
      clearDismissedNotifications: () => set({ dismissedNotificationIds: [] }),
      reset: () => set({ hasAcceptedDisclaimer: false, dismissedNotificationIds: [] })
    }),
    {
      name: 'trace-9-ui-state',
    }
  )
);
