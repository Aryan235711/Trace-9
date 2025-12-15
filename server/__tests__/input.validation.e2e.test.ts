import http from 'http';
import express from 'express';
import request from 'supertest';

jest.setTimeout(60000);

describe('🔍 Comprehensive User Input Validation Tests', () => {
  let server: http.Server;
  let agent: any;
  let mockStorage: any;
  const userId = 'validation-e2e-user';
  
  beforeAll(async () => {
    // Setup mock storage
    mockStorage = {
      upsertUser: jest.fn(async (userData: any) => ({ id: userData?.id || userId, ...userData })),
      getUser: jest.fn(async () => ({ id: userId })),
      getUserTargets: jest.fn(async () => ({
        proteinTarget: 100, gutTarget: 5, sunTarget: 5, exerciseTarget: 5,
        sleepBaseline: 8, rhrBaseline: 65, hrvBaseline: 50,
        isBaselineComplete: true, onboardingComplete: true
      })),
      createUserTargets: jest.fn(async (data: any) => ({ id: 'targets-1', ...data })),
      updateUserTargets: jest.fn(async (_uid: string, updates: any) => ({ id: 'targets-1', userId, ...updates })),
      getDailyLogs: jest.fn(async () => []),
      createDailyLog: jest.fn(async (data) => ({ id: 'test-log', ...data })),
      updateDailyLog: jest.fn(async (id, data) => ({ id, ...data })),
      getDailyLog: jest.fn(async () => null),
      deleteDailyLog: jest.fn(async () => undefined),
      getInterventions: jest.fn(async () => []),
      getIntervention: jest.fn(async () => null),
      getActiveIntervention: jest.fn(async () => null),
      createIntervention: jest.fn(async (data: any) => ({ id: 'int-1', ...data })),
      updateIntervention: jest.fn(async (id: string, updates: any) => ({ id, ...updates })),
    };
    
    jest.doMock('../storage', () => ({ storage: mockStorage }));
    jest.doMock('../replitAuth', () => ({
      setupAuth: async () => {},
      isAuthenticated: (req: any, res: any, next: any) => {
        const headerUser = (req.headers['x-test-user'] as string) || userId;
        req.user = { claims: { sub: headerUser }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
        req.isAuthenticated = () => true;
        return next();
      }
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

  describe('🔢 Numeric Input Boundaries', () => {
    test('rejects negative sleep values', async () => {
      const res = await agent.post('/api/logs').set('x-test-user', userId).send({
        date: '2024-01-01', sleep: -1, rhr: 65, hrv: 50,
        protein: 100, gut: 5, sun: 5, exercise: 5,
        symptomScore: 0, symptomName: 'none'
      });
      expect(res.status).toBe(400);
    });

    test('rejects extreme RHR values', async () => {
      const res = await agent.post('/api/logs').set('x-test-user', userId).send({
        date: '2024-01-01', sleep: 8, rhr: 300, hrv: 50,
        protein: 100, gut: 5, sun: 5, exercise: 5,
        symptomScore: 0, symptomName: 'none'
      });
      expect(res.status).toBe(400);
    });

    test('rejects invalid gut scale values', async () => {
      const res = await agent.post('/api/logs').set('x-test-user', userId).send({
        date: '2024-01-01', sleep: 8, rhr: 65, hrv: 50,
        protein: 100, gut: 10, sun: 5, exercise: 5,
        symptomScore: 0, symptomName: 'none'
      });
      expect(res.status).toBe(400);
    });
  });

  describe('📅 Date Input Validation', () => {
    test('rejects invalid calendar dates', async () => {
      const res = await agent.post('/api/logs').set('x-test-user', userId).send({
        date: '2024-02-30', sleep: 8, rhr: 65, hrv: 50,
        protein: 100, gut: 5, sun: 5, exercise: 5,
        symptomScore: 0, symptomName: 'none'
      });
      expect(res.status).toBe(400);
    });

    test('rejects malformed date strings', async () => {
      const res = await agent.post('/api/logs').set('x-test-user', userId).send({
        date: 'invalid-date', sleep: 8, rhr: 65, hrv: 50,
        protein: 100, gut: 5, sun: 5, exercise: 5,
        symptomScore: 0, symptomName: 'none'
      });
      expect(res.status).toBe(400);
    });
  });

  describe('🛡️ Security Input Validation', () => {
    test('rejects SQL injection in symptomName', async () => {
      const res = await agent.post('/api/logs').set('x-test-user', userId).send({
        date: '2024-01-01', sleep: 8, rhr: 65, hrv: 50,
        protein: 100, gut: 5, sun: 5, exercise: 5,
        symptomScore: 0, symptomName: "'; DROP TABLE users; --"
      });
      expect(res.status).toBe(400);
    });

    test('rejects XSS payloads in symptomName', async () => {
      const res = await agent.post('/api/logs').set('x-test-user', userId).send({
        date: '2024-01-01', sleep: 8, rhr: 65, hrv: 50,
        protein: 100, gut: 5, sun: 5, exercise: 5,
        symptomScore: 0, symptomName: '<script>alert("xss")</script>'
      });
      expect(res.status).toBe(400);
    });
  });

  describe('📊 Missing Field Handling', () => {
    test('rejects incomplete log data', async () => {
      const res = await agent.post('/api/logs').set('x-test-user', userId).send({
        date: '2024-01-01', sleep: 8
        // Missing required fields
      });
      expect(res.status).toBe(400);
    });
  });
});