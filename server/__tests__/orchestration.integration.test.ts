import http from 'http';
import express from 'express';
import request from 'supertest';

// Reuse FlowLogger style debugging
class FlowLogger {
  static log(level: string, message: string, ctx?: any) {
    console.log(`[${new Date().toISOString()}] ${level}: ${message}${ctx ? ' ' + JSON.stringify(ctx) : ''}`);
  }
}

function createMockStorage() {
  const userTargets: Record<string, any> = {};
  const dailyLogs: Record<string, any[]> = {};
  const interventions: any[] = [];

  return {
    getUserTargets: jest.fn(async (userId: string) => userTargets[userId] || null),
    createUserTargets: jest.fn(async (data: any) => { userTargets[data.userId] = data; return userTargets[data.userId]; }),
    updateUserTargets: jest.fn(async (userId: string, updates: any) => { userTargets[userId] = { ...userTargets[userId], ...updates }; return userTargets[userId]; }),
    getDailyLogs: jest.fn(async (userId: string, start?: string, end?: string) => {
      const logs = dailyLogs[userId] || [];
      if (!start && !end) return logs;
      return logs.filter(l => l.date >= (start || '') && l.date <= (end || '')); 
    }),
    createDailyLog: jest.fn(async (log: any) => { if (!dailyLogs[log.userId]) dailyLogs[log.userId]=[]; dailyLogs[log.userId].push(log); return log; }),
    getInterventions: jest.fn(async (userId: string) => interventions.filter(i => i.userId === userId)),
    createIntervention: jest.fn(async (data: any) => { const id = `i-${interventions.length+1}`; const intv = { id, ...data }; interventions.push(intv); return intv; }),
    _getState: () => ({ userTargets, dailyLogs, interventions }),
    _clearAll: () => { Object.keys(userTargets).forEach(k=>delete userTargets[k]); Object.keys(dailyLogs).forEach(k=>delete dailyLogs[k]); interventions.length=0; }
  } as any;
}

describe('orchestration integration (debug)', () => {
  test('runs full flow and exposes detectClusters via debug endpoint', async () => {
    const mockStorage = createMockStorage();
    jest.doMock('../storage', () => ({ storage: mockStorage }));
    jest.doMock('../replitAuth', () => ({
      setupAuth: async (app: any) => {},
      isAuthenticated: (req: any, res: any, next: any) => { req.user = { claims: { sub: 'debug-user' } }; req.isAuthenticated = () => true; return next(); }
    }));

    const { registerRoutes } = await import('../routes');
    const app = express(); app.use(express.json());
    const server = http.createServer(app);
    await registerRoutes(server, app);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const agent = request(server);

    // Start onboarding
    await agent.post('/api/onboarding/start').set('x-test-user','debug-user').send({ proteinTarget: 100, gutTarget: 5, sunTarget: 5, exerciseTarget: 5 });

    // Mark baseline complete (avoid posting 7 baseline logs just for this test)
    await agent.put('/api/targets').set('x-test-user','debug-user').send({
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
    });

    // Post 3 problem logs
    const problemStart = new Date('2024-01-08');
    for (let i=0;i<3;i++) {
      const d = new Date(problemStart); d.setDate(problemStart.getDate()+i); const dateStr = d.toISOString().split('T')[0];
      await agent.post('/api/logs').set('x-test-user','debug-user').send({ date: dateStr, sleep:5, rhr:85, hrv:25, protein:60, gut:2, sun:1, exercise:1, symptomScore:4, symptomName:'fatigue' });
    }

    // Query debug detect endpoint
    const debugRes = await agent.get('/__debug/detect?date=2024-01-10').set('x-test-user','debug-user');
    expect(debugRes.status).toBe(200);
    expect(debugRes.body.result).toBeDefined();
    expect(debugRes.body.result.mode).toBe('negative');
    // Clean up
    if (server) {
      (server as any).closeIdleConnections?.();
      (server as any).closeAllConnections?.();
      await new Promise(resolve=>server.close(()=>resolve(undefined)));
    }
  }, 30000);
});
