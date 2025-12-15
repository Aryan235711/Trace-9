import { jest } from '@jest/globals';

// Mock storage to return synthetic logs for detectClusters
const mockLogsForMode1 = [
  {
    userId: 'u1',
    date: '2024-01-06',
    sleep: 5,
    rhr: 85,
    hrv: 25,
    protein: 60,
    gut: 2,
    sun: 1,
    exercise: 1,
    symptomScore: 4,
    sleepFlag: 'RED',
    rhrFlag: 'RED',
    hrvFlag: 'YELLOW',
    proteinFlag: 'RED',
    gutFlag: 'RED',
    sunFlag: 'YELLOW',
    exerciseFlag: 'YELLOW',
  },
  {
    userId: 'u1',
    date: '2024-01-07',
    sleep: 5,
    rhr: 85,
    hrv: 25,
    protein: 60,
    gut: 2,
    sun: 1,
    exercise: 1,
    symptomScore: 5,
    sleepFlag: 'RED',
    rhrFlag: 'RED',
    hrvFlag: 'RED',
    proteinFlag: 'YELLOW',
    gutFlag: 'RED',
    sunFlag: 'RED',
    exerciseFlag: 'YELLOW',
  },
  {
    userId: 'u1',
    date: '2024-01-08',
    sleep: 5,
    rhr: 85,
    hrv: 25,
    protein: 60,
    gut: 2,
    sun: 1,
    exercise: 1,
    symptomScore: 4,
    sleepFlag: 'YELLOW',
    rhrFlag: 'RED',
    hrvFlag: 'YELLOW',
    proteinFlag: 'RED',
    gutFlag: 'RED',
    sunFlag: 'RED',
    exerciseFlag: 'RED',
  }
];

jest.doMock('../storage', () => ({
  storage: {
    getUserTargets: jest.fn(async (userId: string) => {
      return {
        userId,
        proteinTarget: 100,
        gutTarget: 5,
        sunTarget: 5,
        exerciseTarget: 5,
        sleepBaseline: 8,
        rhrBaseline: 65,
        hrvBaseline: 50,
        isBaselineComplete: true,
        onboardingComplete: true,
        activeInterventionId: null,
      };
    }),
    getDailyLogs: jest.fn(async (userId: string, startDate?: string, endDate?: string) => {
      return mockLogsForMode1;
    }),
  }
}));

import { detectClusters } from '../orchestration';

describe('detectClusters unit', () => {
  test('detects negative cluster (Mode 1) for synthetic logs', async () => {
    const res = await detectClusters('u1', 3, '2024-01-08');
    expect(res.mode).toBe('negative');
    expect(res.hypothesis).toBeTruthy();
    expect(Array.isArray(res.clusters)).toBe(true);
  });
});
