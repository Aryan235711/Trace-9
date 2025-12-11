import http from 'http';
import express from 'express';
import request from 'supertest';

// Ensure Jest module isolation for mocking
beforeEach(() => {
  jest.resetModules();
});

function createMockStorage() {
  const interventions: any[] = [];
  const userTargets: Record<string, any> = {};

  return {
    // minimal methods used by the routes under test
    getUserTargets: jest.fn(async (userId: string) => {
      if (!userTargets[userId]) {
        // default targets
        userTargets[userId] = {
          userId,
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5,
          sleepBaseline: null,
          rhrBaseline: null,
          hrvBaseline: null,
          isBaselineComplete: false,
          activeInterventionId: null,
        };
      }
      return userTargets[userId];
    }),
    updateUserTargets: jest.fn(async (userId: string, data: any) => {
      userTargets[userId] = { ...userTargets[userId], ...data };
      return userTargets[userId];
    }),
    createIntervention: jest.fn(async (data: any) => {
      const id = `int-${interventions.length + 1}`;
      const record = { id, ...data, createdAt: new Date() };
      interventions.push(record);
      return record;
    }),
    getIntervention: jest.fn(async (id: string) => {
      return interventions.find((i) => i.id === id) as any;
    }),
    updateIntervention: jest.fn(async (id: string, data: any) => {
      const idx = interventions.findIndex((i) => i.id === id);
      if (idx === -1) return undefined;
      interventions[idx] = { ...interventions[idx], ...data };
      return interventions[idx];
    }),
    getActiveIntervention: jest.fn(async (userId: string) => {
      return interventions.find((i) => i.userId === userId && !i.result) as any;
    }),
    // no-op placeholders for other methods used elsewhere
    upsertUser: jest.fn(async () => ({})),
    getUser: jest.fn(async () => ({})),
    getInterventions: jest.fn(async (userId: string) => interventions.filter(i => i.userId === userId)),
    // Helper to clear data between tests
    _clearData: () => {
      interventions.length = 0;
      Object.keys(userTargets).forEach(key => delete userTargets[key]);
    },
  };
}

describe('Intervention 7-day check-in integration', () => {
  let server: http.Server;
  let agent: any;
  let mockStorage: any;

  beforeAll(async () => {
    mockStorage = createMockStorage();
    // Mock storage and auth before importing routes
    jest.doMock('../storage', () => ({ storage: mockStorage }));
    jest.doMock('../replitAuth', () => ({
      setupAuth: async (app: any) => {},
      isAuthenticated: (req: any, res: any, next: any) => {
        const headerUser = (req.headers['x-test-user'] as string) || 'user-1';
        req.user = { claims: { sub: headerUser }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
        req.isAuthenticated = () => true;
        return next();
      },
    }));

    let registerRoutes: any;
    try {
      registerRoutes = (await import('../routes')).registerRoutes;
    } catch (err) {
      console.error('Failed importing registerRoutes:', err);
      throw err;
    }

    const app = express();
    app.use(express.json());
    server = http.createServer(app);
    try {
      await registerRoutes(server, app);
    } catch (err) {
      console.error('Failed running registerRoutes:', err);
      throw err;
    }

    // Use supertest agent against the express app (no need to listen)
    agent = request(app);
  });

  beforeEach(() => {
    // Clear mock data between tests to avoid interference
    mockStorage._clearData();
  });

  afterAll(async () => {
    if (server) await new Promise((r) => server.close(() => r(undefined)));
  });

  test('creates intervention and allows checkin after endDate, clearing activeInterventionId', async () => {
    // Create an intervention with endDate in the past using mocked storage directly
    const start = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const storage = (await import('../storage')).storage;
    const created = await storage.createIntervention({ userId: 'user-1', hypothesisText: 'Test hypothesis', startDate: start, endDate: end } as any);
    expect(created).toHaveProperty('id');

    // Mark user's activeInterventionId to this id via storage update
    await storage.updateUserTargets('user-1', { activeInterventionId: created.id });

    // Now checkin (should succeed)
    const checkinRes = await agent
      .post(`/api/interventions/${created.id}/checkin`)
      .set('x-test-user', 'user-1')
      .send({ result: 'Yes' });
    expect(checkinRes.status).toBe(200);
    const updated = checkinRes.body;
    expect(updated.result).toBe('Yes');
    expect(updated.completedAt).toBeTruthy();

    // Ensure user's activeInterventionId cleared
    const targets = await storage.getUserTargets('user-1');
    expect(targets).toBeDefined();
    expect(targets!.activeInterventionId).toBeNull();
  });

  test('cannot checkin before endDate (400) and lock remains', async () => {
    // Create intervention with endDate in future
    const start = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const storage = (await import('../storage')).storage;
    const created = await storage.createIntervention({ userId: 'user-1', hypothesisText: 'Future hypothesis', startDate: start, endDate: end } as any);
    expect(created).toHaveProperty('id');
    await storage.updateUserTargets('user-1', { activeInterventionId: created.id });

    const earlyRes = await agent
      .post(`/api/interventions/${created.id}/checkin`)
      .set('x-test-user', 'user-1')
      .send({ result: 'Yes' });
    expect(earlyRes.status).toBe(400);

    const targets = await storage.getUserTargets('user-1');
    expect(targets).toBeDefined();
    expect(targets!.activeInterventionId).toBe(created.id);
  });

  test('ownership enforced (403)', async () => {
    // Create intervention for user-1
    const start = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const storage = (await import('../storage')).storage;
    const created = await storage.createIntervention({ userId: 'user-1', hypothesisText: 'Owner test', startDate: start, endDate: end } as any);

    // Attempt checkin as a different user
    const res = await agent
      .post(`/api/interventions/${created.id}/checkin`)
      .set('x-test-user', 'user-2')
      .send({ result: 'Yes' });
    expect(res.status).toBe(403);
  });

  test('invalid result returns 400', async () => {
    const start = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const storage = (await import('../storage')).storage;
    const created = await storage.createIntervention({ userId: 'user-1', hypothesisText: 'Invalid result test', startDate: start, endDate: end } as any);

    const res = await agent
      .post(`/api/interventions/${created.id}/checkin`)
      .set('x-test-user', 'user-1')
      .send({ result: 'MAYBE' });
    expect(res.status).toBe(400);
  });

  test('non-existent intervention returns 404', async () => {
    const res = await agent
      .post(`/api/interventions/non-existent/checkin`)
      .set('x-test-user', 'user-1')
      .send({ result: 'Yes' });
    expect(res.status).toBe(404);
  });

  test('rejects duplicate hypothesis on manual create (400)', async () => {
    const storage = (await import('../storage')).storage;
    // create existing intervention (completed, in the past)
    const start = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await storage.createIntervention({ userId: 'user-1', hypothesisText: 'Duplicate Hypothesis', startDate: start, endDate: end } as any);

    // Attempt to create via POST with same hypothesis (case-insensitive) but non-overlapping dates
    const futureStart = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    const futureEnd = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const res = await agent
      .post('/api/interventions')
      .set('x-test-user', 'user-1')
      .send({ hypothesisText: '  duplicate hypothesis  ', startDate: futureStart.toISOString(), endDate: futureEnd.toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/same hypothesis/i);
  });

  test('rejects overlapping active interventions on manual create (400)', async () => {
    const storage = (await import('../storage')).storage;
    // existing active intervention
    const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    await storage.createIntervention({ userId: 'user-1', hypothesisText: 'Overlap Test', startDate: start, endDate: end } as any);

    // Attempt to create overlapping intervention
    const res = await agent
      .post('/api/interventions')
      .set('x-test-user', 'user-1')
      .send({ hypothesisText: 'New Intervention', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/overlapping active intervention/i);
  });
});
