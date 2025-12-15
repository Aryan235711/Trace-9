import http from 'http';
import express from 'express';
import request from 'supertest';

function createMockStorage() {
  const userTargets: Record<string, any> = {};
  const dailyLogs: Record<string, any[]> = {};

  return {
    upsertUser: jest.fn(async () => ({})),

    getUserTargets: jest.fn(async (userId: string) => userTargets[userId] || null),
    createUserTargets: jest.fn(async (data: any) => {
      userTargets[data.userId] = { id: `t-${data.userId}`, ...data };
      return userTargets[data.userId];
    }),
    updateUserTargets: jest.fn(async (userId: string, updates: any) => {
      userTargets[userId] = { ...userTargets[userId], ...updates };
      return userTargets[userId];
    }),

    getDailyLogs: jest.fn(async (userId: string, startDate?: string, endDate?: string) => {
      const logs = dailyLogs[userId] || [];
      if (!startDate && !endDate) return logs;
      return logs.filter((l) => {
        const d = String(l.date);
        const afterStart = !startDate || d >= startDate;
        const beforeEnd = !endDate || d <= endDate;
        return afterStart && beforeEnd;
      });
    }),
    getDailyLog: jest.fn(async (userId: string, date: string) => {
      const logs = dailyLogs[userId] || [];
      return logs.find((l) => l.date === date) || null;
    }),
    createDailyLog: jest.fn(async (logData: any) => {
      const id = `log-${(dailyLogs[logData.userId]?.length || 0) + 1}`;
      const log = { id, ...logData };
      dailyLogs[logData.userId] = [...(dailyLogs[logData.userId] || []), log];
      return log;
    }),
    updateDailyLog: jest.fn(async (logId: string, updates: any) => {
      for (const uid of Object.keys(dailyLogs)) {
        const idx = dailyLogs[uid].findIndex((l) => l.id === logId);
        if (idx !== -1) {
          dailyLogs[uid][idx] = { ...dailyLogs[uid][idx], ...updates };
          return dailyLogs[uid][idx];
        }
      }
      throw new Error('Log not found');
    }),
    deleteDailyLog: jest.fn(async () => {}),

    getInterventions: jest.fn(async () => []),
    getIntervention: jest.fn(async () => null),
    createIntervention: jest.fn(async () => ({ id: 'int-1' })),
    updateIntervention: jest.fn(async () => ({ id: 'int-1' })),
    getActiveIntervention: jest.fn(async () => null),

    _state: () => ({ userTargets, dailyLogs }),
  };
}

function addDaysIso(start: string, offsetDays: number) {
  const d = new Date(start);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe('Insights API (e2e)', () => {
  let server: http.Server;
  let agent: any;
  let mockStorage: any;

  beforeAll(async () => {
    mockStorage = createMockStorage();

    jest.doMock('../storage', () => ({ storage: mockStorage }));
    jest.doMock('../replitAuth', () => ({
      setupAuth: async () => {},
      isAuthenticated: (_req: any, _res: any, next: any) => next(),
    }));

    const { registerRoutes } = await import('../routes');
    const app = express();
    app.use(express.json());
    server = http.createServer(app);
    await registerRoutes(server, app);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    agent = request(server);
  });

  afterAll(async () => {
    if (server) {
      (server as any).closeIdleConnections?.();
      (server as any).closeAllConnections?.();
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    }
  });

  test('returns provisional before baseline complete', async () => {
    const userId = 'insights-user-1';

    await agent.get('/api/targets').set('x-test-user', userId).expect(200);

    // Create 3 logs
    const baseDate = '2025-12-01';
    for (let i = 0; i < 3; i++) {
      await agent
        .post('/api/logs')
        .set('x-test-user', userId)
        .send({
          date: addDaysIso(baseDate, i),
          sleep: 8,
          rhr: 60,
          hrv: 60,
          protein: 120,
          gut: 5,
          sun: 5,
          exercise: 5,
          symptomScore: 1,
          symptomName: 'none',
        })
        .expect(201);
    }

    const res = await agent.get('/api/insights').set('x-test-user', userId).expect(200);
    expect(res.body.state).toBe('provisional');
    expect(String(res.body.message || '')).toMatch(/gathering data/i);
  });

  test('returns action-required hypothesis after 7+ days and baseline backfill', async () => {
    const userId = 'insights-user-2';

    await agent.get('/api/targets').set('x-test-user', userId).expect(200);

    // Create 7 logs with strong "positive" patterns
    const baseDate = '2025-12-01';
    for (let i = 0; i < 7; i++) {
      await agent
        .post('/api/logs')
        .set('x-test-user', userId)
        .send({
          date: addDaysIso(baseDate, i),
          sleep: 8,
          rhr: 60,
          hrv: 60,
          protein: 120,
          gut: 5,
          sun: 5,
          exercise: 5,
          symptomScore: 1,
          symptomName: 'none',
        })
        .expect(201);
    }

    const insightsRes = await agent.get('/api/insights').set('x-test-user', userId).expect(200);
    expect(insightsRes.body.state).toBe('action-required');
    expect(insightsRes.body.hypothesis).toBeTruthy();

    // Baseline should now be complete for the user
    const targetsRes = await agent.get('/api/targets').set('x-test-user', userId).expect(200);
    expect(targetsRes.body.isBaselineComplete).toBe(true);
  });

  test('returns locked when an active intervention exists (contract shape)', async () => {
    const userId = 'insights-user-3';

    await agent.get('/api/targets').set('x-test-user', userId).expect(200);

    await agent
      .put('/api/targets')
      .set('x-test-user', userId)
      .send({
        proteinTarget: 100,
        gutTarget: 5,
        sunTarget: 5,
        exerciseTarget: 5,
        sleepBaseline: 8,
        rhrBaseline: 65,
        hrvBaseline: 50,
        isBaselineComplete: true,
        onboardingComplete: true,
        activeInterventionId: 'i-locked-1',
      })
      .expect(200);

    const res = await agent.get('/api/insights').set('x-test-user', userId).expect(200);
    expect(res.body.state).toBe('locked');
    expect(res.body.activeInterventionId).toBe('i-locked-1');
    expect(res.body.hypothesis).toBeUndefined();
  });
});
