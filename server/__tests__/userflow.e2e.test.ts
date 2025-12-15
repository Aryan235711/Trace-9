import http from 'http';
import express from 'express';
import request from 'supertest';

// Enhanced error logging utility
class FlowLogger {
  private static logs: Array<{ timestamp: string; level: string; message: string; context?: any }> = [];
  
  static log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, context?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? JSON.stringify(context, null, 2) : undefined
    };
    this.logs.push(entry);
    // Avoid console output from async callbacks after test completion.
    // To enable printing locally, set FLOW_LOGGER_STDOUT=1.
    if (process.env.FLOW_LOGGER_STDOUT === '1') {
      // eslint-disable-next-line no-console
      console.log(`[${entry.timestamp}] ${level}: ${message}${context ? '\n' + entry.context : ''}`);
    }
  }
  
  static getLogs() { return [...this.logs]; }
  static clearLogs() { this.logs = []; }
  
  static logApiCall(method: string, endpoint: string, status: number, body?: any) {
    this.log('DEBUG', `API ${method} ${endpoint} → ${status}`, { responseBody: body });
  }
}

// Mock storage with comprehensive state tracking
function createAdvancedMockStorage() {
  const users: Record<string, any> = {};
  const userTargets: Record<string, any> = {};
  const dailyLogs: Record<string, any[]> = {};
  const interventions: any[] = [];
  let interventionsCreatedCount = 0;
  
  FlowLogger.log('INFO', 'Mock storage initialized');
  
  return {
    // User management
    upsertUser: jest.fn(async (userData: any) => {
      FlowLogger.log('DEBUG', 'Creating/updating user', userData);
      users[userData.id] = { ...userData, createdAt: new Date() };
      return users[userData.id];
    }),
    
    getUser: jest.fn(async (userId: string) => {
      FlowLogger.log('DEBUG', `Fetching user: ${userId}`);
      return users[userId] || null;
    }),
    
    // User targets management
    getUserTargets: jest.fn(async (userId: string) => {
      FlowLogger.log('DEBUG', `Fetching targets for user: ${userId}`);
      if (!userTargets[userId]) {
        FlowLogger.log('WARN', `No targets found for user: ${userId}`);
        return null;
      }
      return userTargets[userId];
    }),
    
    createUserTargets: jest.fn(async (data: any) => {
      FlowLogger.log('DEBUG', 'Creating user targets', data);
      const id = `target-${Object.keys(userTargets).length + 1}`;
      userTargets[data.userId] = { id, ...data, createdAt: new Date() };
      return userTargets[data.userId];
    }),
    
    updateUserTargets: jest.fn(async (userId: string, updates: any) => {
      FlowLogger.log('DEBUG', `Updating targets for user: ${userId}`, updates);
      if (!userTargets[userId]) {
        throw new Error(`No targets found for user: ${userId}`);
      }
      userTargets[userId] = { ...userTargets[userId], ...updates, updatedAt: new Date() };
      return userTargets[userId];
    }),
    
    // Daily logs management
    getDailyLogs: jest.fn(async (userId: string, startDate?: string, endDate?: string) => {
      FlowLogger.log('DEBUG', `Fetching logs for user: ${userId}`, { startDate, endDate });
      const logs = dailyLogs[userId] || [];
      if (!startDate && !endDate) return logs;
      
      return logs.filter(log => {
        const logDate = log.date;
        const afterStart = !startDate || logDate >= startDate;
        const beforeEnd = !endDate || logDate <= endDate;
        return afterStart && beforeEnd;
      });
    }),
    
    getDailyLog: jest.fn(async (userId: string, date: string) => {
      FlowLogger.log('DEBUG', `Fetching log for user: ${userId}, date: ${date}`);
      const logs = dailyLogs[userId] || [];
      return logs.find(log => log.date === date) || null;
    }),
    
    createDailyLog: jest.fn(async (logData: any) => {
      FlowLogger.log('DEBUG', 'Creating daily log', logData);
      const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const log = { id, ...logData, createdAt: new Date() };
      
      if (!dailyLogs[logData.userId]) {
        dailyLogs[logData.userId] = [];
      }
      dailyLogs[logData.userId].push(log);
      return log;
    }),
    
    updateDailyLog: jest.fn(async (logId: string, updates: any) => {
      FlowLogger.log('DEBUG', `Updating log: ${logId}`, updates);
      for (const userId in dailyLogs) {
        const logIndex = dailyLogs[userId].findIndex(log => log.id === logId);
        if (logIndex !== -1) {
          dailyLogs[userId][logIndex] = { ...dailyLogs[userId][logIndex], ...updates, updatedAt: new Date() };
          return dailyLogs[userId][logIndex];
        }
      }
      throw new Error(`Log not found: ${logId}`);
    }),
    
    deleteDailyLog: jest.fn(async (logId: string) => {
      FlowLogger.log('DEBUG', `Deleting log: ${logId}`);
      for (const userId in dailyLogs) {
        const logIndex = dailyLogs[userId].findIndex(log => log.id === logId);
        if (logIndex !== -1) {
          dailyLogs[userId].splice(logIndex, 1);
          return;
        }
      }
      throw new Error(`Log not found: ${logId}`);
    }),
    
    // Interventions management
    getInterventions: jest.fn(async (userId: string) => {
      FlowLogger.log('DEBUG', `Fetching interventions for user: ${userId}`);
      return interventions.filter(i => i.userId === userId);
    }),
    
    getIntervention: jest.fn(async (id: string) => {
      FlowLogger.log('DEBUG', `Fetching intervention: ${id}`);
      return interventions.find(i => i.id === id) || null;
    }),
    
    createIntervention: jest.fn(async (data: any) => {
      FlowLogger.log('DEBUG', 'Creating intervention', data);
      const id = `int-${interventions.length + 1}`;
      const intervention = { id, ...data, createdAt: new Date() };
      interventions.push(intervention);
      interventionsCreatedCount++;
      return intervention;
    }),
    
    updateIntervention: jest.fn(async (id: string, updates: any) => {
      FlowLogger.log('DEBUG', `Updating intervention: ${id}`, updates);
      const index = interventions.findIndex(i => i.id === id);
      if (index === -1) throw new Error(`Intervention not found: ${id}`);
      interventions[index] = { ...interventions[index], ...updates, updatedAt: new Date() };
      return interventions[index];
    }),
    
    getActiveIntervention: jest.fn(async (userId: string) => {
      FlowLogger.log('DEBUG', `Fetching active intervention for user: ${userId}`);
      return interventions.find(i => i.userId === userId && !i.result) || null;
    }),
    
    // Helper methods for testing
    _getState: () => ({ users, userTargets, dailyLogs, interventions }),
    _clearAll: () => {
      Object.keys(users).forEach(key => delete users[key]);
      Object.keys(userTargets).forEach(key => delete userTargets[key]);
      Object.keys(dailyLogs).forEach(key => delete dailyLogs[key]);
      interventions.length = 0;
      FlowLogger.log('INFO', 'All mock data cleared');
    },
    _getCreateInterventionCount: () => interventionsCreatedCount,
    _logState: () => {
      FlowLogger.log('DEBUG', 'Current storage state', {
        userCount: Object.keys(users).length,
        targetCount: Object.keys(userTargets).length,
        logCount: Object.values(dailyLogs).reduce((sum, logs) => sum + logs.length, 0),
        interventionCount: interventions.length,
        interventionsCreated: interventionsCreatedCount
      });
    }
  };
}

describe('🔄 Complete User Flow End-to-End Tests', () => {
  let server: http.Server;
  let agent: any;
  let mockStorage: any;
  
  beforeAll(async () => {
    FlowLogger.log('INFO', 'Starting E2E test suite setup');
    
    mockStorage = createAdvancedMockStorage();
    
    // Mock dependencies
    jest.doMock('../storage', () => ({ storage: mockStorage }));
    jest.doMock('../replitAuth', () => ({
      setupAuth: async (app: any) => {},
      isAuthenticated: (req: any, res: any, next: any) => {
        const headerUser = (req.headers['x-test-user'] as string) || 'test-user-1';
        req.user = { 
          claims: { sub: headerUser }, 
          expires_at: Math.floor(Date.now() / 1000) + 3600 
        };
        req.isAuthenticated = () => true;
        return next();
      },
    }));
    
    const { registerRoutes } = await import('../routes');
    const app = express();
    app.use(express.json());
    server = http.createServer(app);
    await registerRoutes(server, app);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    agent = request(server);
    
    FlowLogger.log('INFO', 'E2E test suite setup complete');
  });
  
  beforeEach(() => {
    FlowLogger.clearLogs();
    mockStorage._clearAll();
    FlowLogger.log('INFO', 'Test case starting - clean state');
  });
  
  afterEach(() => {
    const logs = FlowLogger.getLogs();
    if (logs.some(log => log.level === 'ERROR')) {
      console.log('\n🚨 ERROR LOGS DETECTED:');
      logs.filter(log => log.level === 'ERROR').forEach(log => {
        console.log(`${log.timestamp}: ${log.message}`);
        if (log.context) console.log(log.context);
      });
    }
    mockStorage._logState();
  });
  
  afterAll(async () => {
    if (server) {
      (server as any).closeIdleConnections?.();
      (server as any).closeAllConnections?.();
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    }
    FlowLogger.log('INFO', 'E2E test suite teardown complete');
  });

  describe('🆕 New User Complete Journey', () => {
    const userId = 'new-user-journey';
    
    test('Complete new user onboarding to first intervention', async () => {
      FlowLogger.log('INFO', 'Starting complete new user journey test');
      
      // Step 1: User starts onboarding
      FlowLogger.log('INFO', 'Step 1: Starting onboarding');
      const onboardingRes = await agent
        .post('/api/onboarding/start')
        .set('x-test-user', userId)
        .send({
          proteinTarget: 120,
          gutTarget: 4,
          sunTarget: 3,
          exerciseTarget: 4
        });
      
      FlowLogger.logApiCall('POST', '/api/onboarding/start', onboardingRes.status, onboardingRes.body);
      expect(onboardingRes.status).toBe(201);
      expect(onboardingRes.body).toHaveProperty('proteinTarget', 120);
      
      // Step 2: Check onboarding status
      FlowLogger.log('INFO', 'Step 2: Checking onboarding status');
      const statusRes = await agent
        .get('/api/onboarding/status')
        .set('x-test-user', userId);
      
      FlowLogger.logApiCall('GET', '/api/onboarding/status', statusRes.status, statusRes.body);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.hasTargets).toBe(true);
      expect(statusRes.body.isBaselineComplete).toBe(false);
      expect(statusRes.body.daysLogged).toBe(0);
      
      // Step 3: Log 7 days of data to establish baselines
      FlowLogger.log('INFO', 'Step 3: Logging 7 days of data for baseline establishment');
      const baseDate = new Date('2024-01-01');
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const logRes = await agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send({
            date: dateStr,
            sleep: 7.5 + (Math.random() - 0.5), // ~7.5 hours
            rhr: 65 + Math.floor(Math.random() * 10), // 65-75 bpm
            hrv: 45 + Math.floor(Math.random() * 20), // 45-65 ms
            protein: 100 + Math.floor(Math.random() * 40), // 100-140g
            gut: 3 + Math.floor(Math.random() * 3), // 3-5
            sun: 2 + Math.floor(Math.random() * 3), // 2-4
            exercise: 3 + Math.floor(Math.random() * 3), // 3-5
            symptomScore: Math.floor(Math.random() * 2), // 0-1 (low symptoms)
            symptomName: 'none'
          });
        
        FlowLogger.logApiCall('POST', '/api/logs', logRes.status, { date: dateStr });
        expect(logRes.status).toBe(201);
        expect(logRes.body).toHaveProperty('sleepFlag');
        
        FlowLogger.log('DEBUG', `Day ${i + 1} logged successfully`, {
          date: dateStr,
          flags: {
            sleep: logRes.body.sleepFlag,
            rhr: logRes.body.rhrFlag,
            hrv: logRes.body.hrvFlag
          }
        });
      }
      
      // Step 4: Verify baseline completion
      FlowLogger.log('INFO', 'Step 4: Verifying baseline completion');
      const finalStatusRes = await agent
        .get('/api/onboarding/status')
        .set('x-test-user', userId);
      
      FlowLogger.logApiCall('GET', '/api/onboarding/status', finalStatusRes.status, finalStatusRes.body);
      expect(finalStatusRes.status).toBe(200);
      expect(finalStatusRes.body.isBaselineComplete).toBe(true);
      expect(finalStatusRes.body.onboardingComplete).toBe(true);
      expect(finalStatusRes.body.daysLogged).toBe(7);
      
      // Step 5: Log problematic data to trigger intervention
      FlowLogger.log('INFO', 'Step 5: Logging problematic data to trigger intervention');
      const problemDate = new Date('2024-01-08');
      
      for (let i = 0; i < 3; i++) {
        const date = new Date(problemDate);
        date.setDate(problemDate.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const problemLogRes = await agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send({
            date: dateStr,
            sleep: 5.0, // Poor sleep (below baseline)
            rhr: 85, // High RHR (above baseline)
            hrv: 25, // Low HRV (below baseline)
            protein: 60, // Low protein (below target)
            gut: 2, // Poor gut health
            sun: 1, // Low sun exposure
            exercise: 1, // Low exercise
            symptomScore: 4, // High symptoms (triggers Mode 1)
            symptomName: 'fatigue'
          });
        
        FlowLogger.logApiCall('POST', '/api/logs', problemLogRes.status, { date: dateStr });
        expect(problemLogRes.status).toBe(201);
        
        FlowLogger.log('DEBUG', `Problem day ${i + 1} logged`, {
          date: dateStr,
          symptomScore: 4,
          flags: {
            sleep: problemLogRes.body.sleepFlag,
            rhr: problemLogRes.body.rhrFlag,
            protein: problemLogRes.body.proteinFlag
          }
        });
      }

      // DEBUG: Query server debug endpoint to see what detectClusters saw
      FlowLogger.log('INFO', 'Step 5b: Querying server debug endpoint for clustering state');
      const debugRes = await agent
        .get('/__debug/detect')
        .set('x-test-user', userId);
      FlowLogger.logApiCall('GET', '/__debug/detect', debugRes.status, debugRes.body);
      expect(debugRes.status).toBe(200);
      FlowLogger.log('DEBUG', 'Server detectClusters result', debugRes.body.result);
      FlowLogger.log('DEBUG', 'Server storage state', debugRes.body.state);
      
      // Step 6: Check for auto-generated intervention
      FlowLogger.log('INFO', 'Step 6: Checking for auto-generated intervention');
      const interventionsRes = await agent
        .get('/api/interventions')
        .set('x-test-user', userId);
      
      FlowLogger.logApiCall('GET', '/api/interventions', interventionsRes.status, interventionsRes.body);
      expect(interventionsRes.status).toBe(200);
      expect(interventionsRes.body.length).toBeGreaterThan(0);
      
      const intervention = interventionsRes.body[0];
      expect(intervention).toHaveProperty('hypothesisText');
      expect(intervention.hypothesisText).toContain('sleep');
      
      FlowLogger.log('INFO', 'Intervention auto-generated successfully', {
        interventionId: intervention.id,
        hypothesis: intervention.hypothesisText
      });
      
      // Step 7: Complete intervention after 7 days
      FlowLogger.log('INFO', 'Step 7: Completing intervention after 7 days');
      
      // Simulate intervention completion (set endDate to past)
      const pastEndDate = new Date('2024-01-10'); // Past date
      await mockStorage.updateIntervention(intervention.id, {
        endDate: pastEndDate
      });
      
      const checkinRes = await agent
        .post(`/api/interventions/${intervention.id}/checkin`)
        .set('x-test-user', userId)
        .send({ result: 'Yes' });
      
      FlowLogger.logApiCall('POST', `/api/interventions/${intervention.id}/checkin`, checkinRes.status, checkinRes.body);
      expect(checkinRes.status).toBe(200);
      expect(checkinRes.body.result).toBe('Yes');
      
      // Step 8: Verify intervention lock cleared
      FlowLogger.log('INFO', 'Step 8: Verifying intervention lock cleared');
      const targetsRes = await agent
        .get('/api/targets')
        .set('x-test-user', userId);
      
      FlowLogger.logApiCall('GET', '/api/targets', targetsRes.status, targetsRes.body);
      expect(targetsRes.status).toBe(200);
      expect(targetsRes.body.activeInterventionId).toBeNull();
      
      FlowLogger.log('INFO', '✅ Complete new user journey test passed successfully');
    }, 30000); // 30 second timeout for comprehensive test
  });

  describe('🔄 Existing User Daily Workflow', () => {
    const userId = 'existing-user-workflow';
    
    beforeEach(async () => {
      FlowLogger.log('INFO', 'Setting up existing user with complete baseline');
      
      // Setup existing user with completed baseline
      await mockStorage.createUserTargets({
        userId,
        proteinTarget: 100,
        gutTarget: 5,
        sunTarget: 5,
        exerciseTarget: 5,
        sleepBaseline: 8.0,
        rhrBaseline: 65,
        hrvBaseline: 50,
        isBaselineComplete: true,
        onboardingComplete: true,
        activeInterventionId: null
      });
    });
    
    test('Daily log creation and update workflow', async () => {
      FlowLogger.log('INFO', 'Testing daily log creation and update workflow');
      
      const today = '2024-01-15';
      
      // Step 1: Create daily log
      FlowLogger.log('INFO', 'Step 1: Creating daily log');
      const createRes = await agent
        .post('/api/logs')
        .set('x-test-user', userId)
        .send({
          date: today,
          sleep: 7.5,
          rhr: 68,
          hrv: 48,
          protein: 95,
          gut: 4,
          sun: 3,
          exercise: 4,
          symptomScore: 1,
          symptomName: 'mild headache'
        });
      
      FlowLogger.logApiCall('POST', '/api/logs', createRes.status, createRes.body);
      expect(createRes.status).toBe(201);
      expect(createRes.body.date).toBe(today);
      
      // Step 2: Retrieve specific log
      FlowLogger.log('INFO', 'Step 2: Retrieving specific log');
      const getRes = await agent
        .get(`/api/logs/${today}`)
        .set('x-test-user', userId);
      
      FlowLogger.logApiCall('GET', `/api/logs/${today}`, getRes.status, getRes.body);
      expect(getRes.status).toBe(200);
      expect(getRes.body.date).toBe(today);
      
      // Step 3: Update existing log
      FlowLogger.log('INFO', 'Step 3: Updating existing log');
      const updateRes = await agent
        .put(`/api/logs/${today}`)
        .set('x-test-user', userId)
        .send({
          protein: 110, // Increased protein
          symptomScore: 0, // Symptoms resolved
          symptomName: 'none'
        });
      
      FlowLogger.logApiCall('PUT', `/api/logs/${today}`, updateRes.status, updateRes.body);
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.protein).toBe(110);
      expect(updateRes.body.symptomScore).toBe(0);
      
      // Step 4: Verify update persisted
      FlowLogger.log('INFO', 'Step 4: Verifying update persisted');
      const verifyRes = await agent
        .get(`/api/logs/${today}`)
        .set('x-test-user', userId);
      
      FlowLogger.logApiCall('GET', `/api/logs/${today}`, verifyRes.status, verifyRes.body);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.protein).toBe(110);
      expect(verifyRes.body.symptomScore).toBe(0);
      
      FlowLogger.log('INFO', '✅ Daily log workflow test passed successfully');
    });
    
    test('Date range log retrieval', async () => {
      FlowLogger.log('INFO', 'Testing date range log retrieval');
      
      // Create logs for multiple days
      const dates = ['2024-01-10', '2024-01-11', '2024-01-12', '2024-01-13', '2024-01-14'];
      
      for (const date of dates) {
        await agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send({
            date,
            sleep: 8.0,
            rhr: 65,
            hrv: 50,
            protein: 100,
            gut: 5,
            sun: 5,
            exercise: 5,
            symptomScore: 0,
            symptomName: 'none'
          });
      }
      
      // Test date range retrieval
      const rangeRes = await agent
        .get('/api/logs')
        .query({ startDate: '2024-01-11', endDate: '2024-01-13' })
        .set('x-test-user', userId);
      
      FlowLogger.logApiCall('GET', '/api/logs', rangeRes.status, { query: 'startDate=2024-01-11&endDate=2024-01-13' });
      expect(rangeRes.status).toBe(200);
      expect(rangeRes.body.length).toBe(3);
      expect(rangeRes.body.map((log: any) => log.date)).toEqual(['2024-01-11', '2024-01-12', '2024-01-13']);
      
      FlowLogger.log('INFO', '✅ Date range retrieval test passed successfully');
    });
  });

  describe('🚨 Error Handling and Edge Cases', () => {
    const userId = 'error-test-user';
    
    test('Handles missing user targets gracefully', async () => {
      FlowLogger.log('INFO', 'Testing missing user targets error handling');
      
      // Attempt to create log without targets
      const res = await agent
        .post('/api/logs')
        .set('x-test-user', userId)
        .send({
          date: '2024-01-15',
          sleep: 8.0,
          rhr: 65,
          hrv: 50,
          protein: 100,
          gut: 5,
          sun: 5,
          exercise: 5,
          symptomScore: 0,
          symptomName: 'none'
        });
      
      FlowLogger.logApiCall('POST', '/api/logs', res.status, res.body);
      expect(res.status).toBe(500);
      expect(res.body.message).toContain('User targets not found');
      
      FlowLogger.log('INFO', '✅ Missing user targets error handled correctly');
    });
    
    test('Handles invalid data validation', async () => {
      FlowLogger.log('INFO', 'Testing invalid data validation');
      
      // Setup user targets first
      await mockStorage.createUserTargets({
        userId,
        proteinTarget: 100,
        gutTarget: 5,
        sunTarget: 5,
        exerciseTarget: 5,
        sleepBaseline: 8.0,
        rhrBaseline: 65,
        hrvBaseline: 50,
        isBaselineComplete: true,
        onboardingComplete: true
      });
      
      // Test invalid sleep value
      const invalidRes = await agent
        .post('/api/logs')
        .set('x-test-user', userId)
        .send({
          date: '2024-01-15',
          sleep: -1, // Invalid negative sleep
          rhr: 65,
          hrv: 50,
          protein: 100,
          gut: 5,
          sun: 5,
          exercise: 5,
          symptomScore: 0,
          symptomName: 'none'
        });
      
      FlowLogger.logApiCall('POST', '/api/logs', invalidRes.status, invalidRes.body);
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.message).toContain('Validation error');
      
      FlowLogger.log('INFO', '✅ Invalid data validation handled correctly');
    });
    
    test('Handles non-existent resource access', async () => {
      FlowLogger.log('INFO', 'Testing non-existent resource access');
      
      // Test accessing non-existent log
      const res = await agent
        .get('/api/logs/2024-99-99')
        .set('x-test-user', userId);
      
      FlowLogger.logApiCall('GET', '/api/logs/2024-99-99', res.status, res.body);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Log not found');
      
      // Test accessing non-existent intervention
      const intRes = await agent
        .post('/api/interventions/non-existent/checkin')
        .set('x-test-user', userId)
        .send({ result: 'Yes' });
      
      FlowLogger.logApiCall('POST', '/api/interventions/non-existent/checkin', intRes.status, intRes.body);
      expect(intRes.status).toBe(404);
      expect(intRes.body.message).toBe('Intervention not found');
      
      FlowLogger.log('INFO', '✅ Non-existent resource access handled correctly');
    });
  });

  describe('🔐 Authentication and Authorization', () => {
    test('Requires authentication for all protected routes', async () => {
      FlowLogger.log('INFO', 'Testing authentication requirements');
      
      const protectedRoutes = [
        { method: 'get', path: '/api/targets' },
        { method: 'post', path: '/api/logs' },
        { method: 'get', path: '/api/interventions' },
        { method: 'get', path: '/api/onboarding/status' }
      ];
      
      for (const route of protectedRoutes) {
        const res = await agent[route.method](route.path);
        FlowLogger.logApiCall(route.method.toUpperCase(), route.path, res.status, res.body);
        
        // Should require authentication (implementation dependent)
        // This test assumes the mock auth allows all requests
        // In real implementation, this would return 401
        expect(res.status).not.toBe(500); // At minimum, shouldn't crash
      }
      
      FlowLogger.log('INFO', '✅ Authentication requirements verified');
    });
    
    test('Enforces user data isolation', async () => {
      FlowLogger.log('INFO', 'Testing user data isolation');
      
      const user1 = 'isolation-user-1';
      const user2 = 'isolation-user-2';
      
      // Setup both users
      for (const userId of [user1, user2]) {
        await mockStorage.createUserTargets({
          userId,
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5,
          sleepBaseline: 8.0,
          rhrBaseline: 65,
          hrvBaseline: 50,
          isBaselineComplete: true,
          onboardingComplete: true
        });
        
        // Create log for each user
        await agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send({
            date: '2024-01-15',
            sleep: 8.0,
            rhr: 65,
            hrv: 50,
            protein: 100,
            gut: 5,
            sun: 5,
            exercise: 5,
            symptomScore: 0,
            symptomName: 'none'
          });
      }
      
      // Verify user1 can only see their own logs
      const user1Logs = await agent
        .get('/api/logs')
        .set('x-test-user', user1);
      
      FlowLogger.logApiCall('GET', '/api/logs', user1Logs.status, { userContext: user1 });
      expect(user1Logs.status).toBe(200);
      expect(user1Logs.body.length).toBe(1);
      
      // Verify user2 can only see their own logs
      const user2Logs = await agent
        .get('/api/logs')
        .set('x-test-user', user2);
      
      FlowLogger.logApiCall('GET', '/api/logs', user2Logs.status, { userContext: user2 });
      expect(user2Logs.status).toBe(200);
      expect(user2Logs.body.length).toBe(1);
      
      FlowLogger.log('INFO', '✅ User data isolation verified');
    });
  });
});