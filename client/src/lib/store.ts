import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, format, subDays } from 'date-fns';

// Types based on the spec
export type Flag = 'GREEN' | 'YELLOW' | 'RED';

export interface MetricValues {
  sleep: number; // hours
  rhr: number;   // bpm
  hrv: number;   // ms
  protein: number; // grams
  gut: number;     // 1-5
  sun: number;     // 1, 3, 5 (No, Partial, Yes)
  exercise: number; // 1, 2, 4, 5 (None, Light, Medium, Hard)
  symptomScore: number; // 1-5
  symptomName?: string;
}

export interface DailyLog {
  date: string; // ISO date string YYYY-MM-DD
  rawValues: MetricValues;
  processedState: Record<keyof MetricValues, Flag>;
}

export interface UserTargets {
  protein: number;
  gut: number;
  sun: number;
  exercise: number;
}

export interface Intervention {
  id: string;
  text: string;
  startDate: string;
  endDate: string;
  result?: 'Yes' | 'No' | 'Partial';
}

interface AppState {
  hasAcceptedDisclaimer: boolean;
  isBaselineComplete: boolean;
  targets: UserTargets;
  logs: DailyLog[];
  activeIntervention: Intervention | null;
  pastInterventions: Intervention[];
  
  // Actions
  acceptDisclaimer: () => void;
  setTargets: (targets: UserTargets) => void;
  addLog: (log: DailyLog) => void;
  startIntervention: (text: string) => void;
  completeIntervention: (result: 'Yes' | 'No' | 'Partial') => void;
  reset: () => void;
}

// Helper to generate mock data for the heatmap
const generateMockHistory = (): DailyLog[] => {
  const logs: DailyLog[] = [];
  const today = new Date();
  
  for (let i = 13; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Randomish data
    const r = Math.random();
    const sleep = 6 + Math.random() * 3;
    const rhr = 55 + Math.random() * 15;
    const hrv = 40 + Math.random() * 40;
    
    // Simple mock flagging logic for initialization
    const getFlag = (val: number, target: number, isLowerBetter = false): Flag => {
      const ratio = val / target;
      if (isLowerBetter) return 'GREEN'; // Simplification
      if (ratio >= 0.9) return 'GREEN';
      if (ratio >= 0.8) return 'YELLOW';
      return 'RED';
    };

    logs.push({
      date: dateStr,
      rawValues: {
        sleep, rhr, hrv, protein: 100, gut: 4, sun: 5, exercise: 5, symptomScore: r > 0.8 ? 4 : 2
      },
      processedState: {
        sleep: getFlag(sleep, 7.5),
        rhr: getFlag(rhr, 60), // inverted logic handled in UI for brevity
        hrv: getFlag(hrv, 50),
        protein: 'GREEN',
        gut: 'GREEN',
        sun: i % 3 === 0 ? 'RED' : 'GREEN',
        exercise: i % 4 === 0 ? 'YELLOW' : 'GREEN',
        symptomScore: r > 0.8 ? 'RED' : 'GREEN',
        symptomName: 'GREEN' // Placeholder
      }
    });
  }
  return logs;
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      hasAcceptedDisclaimer: false,
      isBaselineComplete: false,
      targets: {
        protein: 100,
        gut: 5,
        sun: 5,
        exercise: 5
      },
      logs: generateMockHistory(),
      activeIntervention: null,
      pastInterventions: [],

      acceptDisclaimer: () => set({ hasAcceptedDisclaimer: true }),
      setTargets: (targets: UserTargets) => set({ targets, isBaselineComplete: true }),
      addLog: (log: DailyLog) => set((state: AppState) => ({ logs: [...state.logs, log] })),
      startIntervention: (text: string) => set({
        activeIntervention: {
          id: Math.random().toString(36),
          text,
          startDate: new Date().toISOString(),
          endDate: addDays(new Date(), 7).toISOString()
        }
      }),
      completeIntervention: (result: 'Yes' | 'No' | 'Partial') => set((state: AppState) => {
        if (!state.activeIntervention) return {};
        const completed: Intervention = { ...state.activeIntervention, result };
        return {
          activeIntervention: null,
          pastInterventions: [completed, ...state.pastInterventions]
        };
      }),
      reset: () => set({ hasAcceptedDisclaimer: false, logs: generateMockHistory() })
    }),
    {
      name: 'trace-9-storage',
    }
  )
);
