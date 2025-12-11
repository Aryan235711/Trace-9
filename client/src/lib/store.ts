import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// UI state only - server state is managed by React Query
interface AppState {
  hasAcceptedDisclaimer: boolean;
  
  // Actions
  acceptDisclaimer: () => void;
  reset: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      hasAcceptedDisclaimer: false,

      acceptDisclaimer: () => set({ hasAcceptedDisclaimer: true }),
      reset: () => set({ hasAcceptedDisclaimer: false })
    }),
    {
      name: 'trace-9-ui-state',
    }
  )
);
