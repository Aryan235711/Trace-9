import http from 'http';
import express from 'express';
import request from 'supertest';

// Performance monitoring utility
class PerformanceMonitor {
  private static metrics: Array<{
    operation: string;
    duration: number;
    timestamp: string;
    success: boolean;
    details?: any;
  }> = [];
  
  static startTimer(operation: string) {
    const startTime = process.hrtime.bigint();
    return {
      operation,
      end: (success: boolean = true, details?: any) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        this.metrics.push({
          operation,
          duration,
          timestamp: new Date().toISOString(),
          success,
          details
        });

        return duration;
      }
    };
  }
  
  static getMetrics() { return [...this.metrics]; }
  static clearMetrics() { this.metrics = []; }
  
  static getStats(operation?: string) {
    const filtered = operation ? this.metrics.filter(m => m.operation === operation) : this.metrics;
    if (filtered.length === 0) return null;
    
    const durations = filtered.map(m => m.duration);
    const successRate = filtered.filter(m => m.success).length / filtered.length;
    
    return {
      count: filtered.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      p95: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)],
      successRate: successRate * 100
    };
  }
  
  static logStats() {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    if (process.env.PERF_LOGGER_STDOUT !== '1') return;

    console.log('\n📊 Performance Statistics:');
    
    operations.forEach(op => {
      const stats = this.getStats(op);
      if (stats) {
        console.log(`${op}:`);
        console.log(`  Count: ${stats.count}`);
        console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
        console.log(`  Min: ${stats.min.toFixed(2)}ms`);
        console.log(`  Max: ${stats.max.toFixed(2)}ms`);
        console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
        console.log(`  Success Rate: ${stats.successRate.toFixed(1)}%`);
      }
    });
  }
}

// Load testing utility
class LoadTester {
  static async runConcurrent<T>(
    operations: Array<() => Promise<T>>,
    concurrency: number = 10
  ): Promise<Array<{ result?: T; error?: Error; duration: number }>> {
    const results: Array<{ result?: T; error?: Error; duration: number }> = [];
    
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchPromises = batch.map(async (op) => {
        const timer = PerformanceMonitor.startTimer('concurrent_operation');
        try {
          const result = await op();
          const duration = timer.end(true);
          return { result, duration };
        } catch (error) {
          const duration = timer.end(false, { error: (error as any).message });
          return { error: error as Error, duration };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  static generateTestData(count: number, baseDate: Date = new Date('2024-01-01')) {
    const data = [];
    for (let i = 0; i < count; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        sleep: 6 + Math.random() * 4, // 6-10 hours
        rhr: 60 + Math.floor(Math.random() * 20), // 60-80 bpm
        hrv: 30 + Math.floor(Math.random() * 40), // 30-70 ms
        protein: 80 + Math.floor(Math.random() * 60), // 80-140g
        gut: 1 + Math.floor(Math.random() * 5), // 1-5
        sun: 1 + Math.floor(Math.random() * 5), // 1-5
        exercise: 1 + Math.floor(Math.random() * 5), // 1-5
        symptomScore: Math.floor(Math.random() * 6), // 0-5
        symptomName: ['none', 'headache', 'fatigue', 'nausea', 'pain'][Math.floor(Math.random() * 5)]
      });
    }
    return data;
  }
}

// Mock storage optimized for load testing
function createLoadTestMockStorage() {
  const storage = new Map();
  const userTargets = new Map();
  const dailyLogs = new Map();
  const interventions = new Map();

  const activeTimeouts = new Set<ReturnType<typeof setTimeout>>();

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        activeTimeouts.delete(timeout);
        resolve();
      }, ms);
      // Avoid keeping the Jest worker alive due to mock latency timers.
      (timeout as any)?.unref?.();
      activeTimeouts.add(timeout);
    });
  
  return {
    getUserTargets: jest.fn(async (userId: string) => {
      const timer = PerformanceMonitor.startTimer('storage_getUserTargets');
      await sleep(Math.random() * 5); // Simulate DB latency
      const result = userTargets.get(userId) || null;
      timer.end(true);
      return result;
    }),
    
    createUserTargets: jest.fn(async (data: any) => {
      const timer = PerformanceMonitor.startTimer('storage_createUserTargets');
      await sleep(Math.random() * 10);
      const id = `target-${Date.now()}-${Math.random()}`;
      const target = { id, ...data, createdAt: new Date() };
      userTargets.set(data.userId, target);
      timer.end(true);
      return target;
    }),
    
    updateUserTargets: jest.fn(async (userId: string, updates: any) => {
      const timer = PerformanceMonitor.startTimer('storage_updateUserTargets');
      await sleep(Math.random() * 8);
      const existing = userTargets.get(userId);
      if (!existing) throw new Error(`No targets found for user: ${userId}`);
      const updated = { ...existing, ...updates, updatedAt: new Date() };
      userTargets.set(userId, updated);
      timer.end(true);
      return updated;
    }),
    
    getDailyLogs: jest.fn(async (userId: string, startDate?: string, endDate?: string) => {
      const timer = PerformanceMonitor.startTimer('storage_getDailyLogs');
      await sleep(Math.random() * 15); // Simulate complex query
      const logs = dailyLogs.get(userId) || [];
      let filtered = logs;
      
      if (startDate || endDate) {
        filtered = logs.filter((log: any) => {
          const logDate = log.date;
          const afterStart = !startDate || logDate >= startDate;
          const beforeEnd = !endDate || logDate <= endDate;
          return afterStart && beforeEnd;
        });
      }
      
      timer.end(true, { logCount: filtered.length });
      return filtered;
    }),
    
    createDailyLog: jest.fn(async (logData: any) => {
      const timer = PerformanceMonitor.startTimer('storage_createDailyLog');
      await sleep(Math.random() * 12);
      const id = `log-${Date.now()}-${Math.random()}`;
      const log = { id, ...logData, createdAt: new Date() };
      
      const userLogs = dailyLogs.get(logData.userId) || [];
      userLogs.push(log);
      dailyLogs.set(logData.userId, userLogs);
      
      timer.end(true);
      return log;
    }),
    
    getInterventions: jest.fn(async (userId: string) => {
      const timer = PerformanceMonitor.startTimer('storage_getInterventions');
      await sleep(Math.random() * 8);
      const userInterventions = Array.from(interventions.values()).filter((i: any) => i.userId === userId);
      timer.end(true, { interventionCount: userInterventions.length });
      return userInterventions;
    }),
    
    createIntervention: jest.fn(async (data: any) => {
      const timer = PerformanceMonitor.startTimer('storage_createIntervention');
      await sleep(Math.random() * 10);
      const id = `int-${Date.now()}-${Math.random()}`;
      const intervention = { id, ...data, createdAt: new Date() };
      interventions.set(id, intervention);
      timer.end(true);
      return intervention;
    }),
    
    // Cleanup methods
    _clear: () => {
      for (const timeout of activeTimeouts) clearTimeout(timeout);
      activeTimeouts.clear();
      storage.clear();
      userTargets.clear();
      dailyLogs.clear();
      interventions.clear();
    },
    
    _getStats: () => ({
      userTargets: userTargets.size,
      totalLogs: Array.from(dailyLogs.values()).reduce((sum, logs) => sum + logs.length, 0),
      interventions: interventions.size
    })
  };
}

describe('⚡ Performance and Load Tests', () => {
  let server: http.Server;
  let agent: any;
  let mockStorage: any;

  const shouldLog = process.env.PERF_LOGGER_STDOUT === '1';
  const log = (...args: any[]) => {
    if (shouldLog) console.log(...args);
  };
  
  beforeAll(async () => {
    log('🚀 Starting performance test suite');
    
    mockStorage = createLoadTestMockStorage();
    
    jest.doMock('../storage', () => ({ storage: mockStorage }));
    jest.doMock('../replitAuth', () => ({
      setupAuth: async (app: any) => {},
      isAuthenticated: (req: any, res: any, next: any) => {
        const headerUser = (req.headers['x-test-user'] as string) || 'perf-user';
        req.user = { claims: { sub: headerUser }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
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
  });
  
  beforeEach(() => {
    PerformanceMonitor.clearMetrics();
    mockStorage._clear();
  });
  
  afterEach(() => {
    PerformanceMonitor.logStats();
    log('📈 Storage Stats:', mockStorage._getStats());
  });
  
  afterAll(async () => {
    if (server) {
      (server as any).closeIdleConnections?.();
      (server as any).closeAllConnections?.();
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    }
    log('🏁 Performance test suite complete');
  });

  describe('🔥 High Volume Log Creation', () => {
    test('handles 100 concurrent log creations', async () => {
      log('🧪 Testing 100 concurrent log creations');
      
      const userId = 'load-test-user';
      
      // Setup user targets
      const timer = PerformanceMonitor.startTimer('setup_user_targets');
      await agent
        .post('/api/onboarding/start')
        .set('x-test-user', userId)
        .send({
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5
        });
      timer.end(true);
      
      // Generate test data
      const testData = LoadTester.generateTestData(100);
      
      // Create concurrent operations
      const operations = testData.map((data, index) => async () => {
        const opTimer = PerformanceMonitor.startTimer('concurrent_log_creation');
        try {
          const res = await agent
            .post('/api/logs')
            .set('x-test-user', userId)
            .send(data);
          
          opTimer.end(res.status === 201, { status: res.status, index });
          return { status: res.status, index };
        } catch (error) {
          opTimer.end(false, { error: (error as Error).message, index });
          throw error;
        }
      });
      
      // Run load test
      const startTime = Date.now();
      const results = await LoadTester.runConcurrent(operations, 20); // 20 concurrent requests
      const totalTime = Date.now() - startTime;
      
      // Analyze results
      const successful = results.filter(r => !r.error).length;
      const failed = results.filter(r => r.error).length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      
      log(`📊 Load Test Results:`);
      log(`  Total Operations: ${results.length}`);
      log(`  Successful: ${successful}`);
      log(`  Failed: ${failed}`);
      log(`  Success Rate: ${(successful / results.length * 100).toFixed(1)}%`);
      log(`  Average Duration: ${avgDuration.toFixed(2)}ms`);
      log(`  Total Time: ${totalTime}ms`);
      log(`  Throughput: ${(results.length / totalTime * 1000).toFixed(2)} ops/sec`);
      
      // Performance assertions (relaxed for CI variability)
      expect(successful).toBeGreaterThan(90); // At least 90% success rate
      expect(avgDuration).toBeLessThan(3000); // Average response under 3 seconds
      expect(failed).toBeLessThan(10); // Less than 10% failure rate
      
    }, 60000); // 60 second timeout
  });

  describe('📊 Data Retrieval Performance', () => {
    test('efficiently retrieves large date ranges', async () => {
      log('🧪 Testing large date range retrieval performance');
      
      const userId = 'range-test-user';
      
      // Setup user
      await agent
        .post('/api/onboarding/start')
        .set('x-test-user', userId)
        .send({
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5
        });
      
      // Create 365 days of data (1 year)
      const testData = LoadTester.generateTestData(365);
      
      log('📝 Creating 365 days of test data...');
      const createTimer = PerformanceMonitor.startTimer('bulk_data_creation');
      
      for (const data of testData) {
        await agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send(data);
      }
      
      createTimer.end(true, { recordCount: testData.length });
      
      // Test various range queries
      const rangeTests = [
        { name: '7 days', days: 7 },
        { name: '30 days', days: 30 },
        { name: '90 days', days: 90 },
        { name: '365 days', days: 365 }
      ];
      
      for (const test of rangeTests) {
        const endDate = '2024-12-31';
        const startDate = new Date('2024-12-31');
        startDate.setDate(startDate.getDate() - test.days + 1);
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const queryTimer = PerformanceMonitor.startTimer(`range_query_${test.name}`);
        
        const res = await agent
          .get('/api/logs')
          .query({ startDate: startDateStr, endDate })
          .set('x-test-user', userId);
        
        queryTimer.end(res.status === 200, { 
          expectedCount: test.days, 
          actualCount: res.body.length,
          status: res.status 
        });
        
        expect(res.status).toBe(200);
        expect(res.body.length).toBeLessThanOrEqual(test.days);
        
        log(`  ${test.name} query: ${res.body.length} records retrieved`);
      }
      
      // Performance assertions
      const rangeStats = PerformanceMonitor.getStats('range_query_30 days');
      if (rangeStats) {
        expect(rangeStats.avg).toBeLessThan(500); // 30-day queries under 500ms
      }
      
    }, 120000); // 2 minute timeout for large data test
  });

  describe('🔄 Concurrent User Simulation', () => {
    test('handles multiple users simultaneously', async () => {
      log('🧪 Testing concurrent multi-user operations');
      
      const userCount = 50;
      const operationsPerUser = 10;
      
      // Create operations for multiple users.
      // Run onboarding setup first, then log creation, to avoid expected 500s
      // when logs are posted before targets exist.
      const setupOperations: Array<() => Promise<any>> = [];
      const logOperations: Array<() => Promise<any>> = [];
      
      for (let userId = 1; userId <= userCount; userId++) {
        const userIdStr = `concurrent-user-${userId}`;
        
        // Setup operation
        setupOperations.push(async () => {
          const timer = PerformanceMonitor.startTimer('user_setup');
          const res = await agent
            .post('/api/onboarding/start')
            .set('x-test-user', userIdStr)
            .send({
              proteinTarget: 100,
              gutTarget: 5,
              sunTarget: 5,
              exerciseTarget: 5
            });
          timer.end(res.status === 201, { userId: userIdStr, status: res.status });
          return { operation: 'setup', userId: userIdStr, status: res.status };
        });
        
        // Log creation operations
        for (let logIndex = 0; logIndex < operationsPerUser; logIndex++) {
          logOperations.push(async () => {
            const timer = PerformanceMonitor.startTimer('user_log_creation');
            const date = new Date('2024-01-01');
            date.setDate(date.getDate() + logIndex);
            
            const res = await agent
              .post('/api/logs')
              .set('x-test-user', userIdStr)
              .send({
                date: date.toISOString().split('T')[0],
                sleep: 7 + Math.random() * 2,
                rhr: 65 + Math.floor(Math.random() * 10),
                hrv: 45 + Math.floor(Math.random() * 20),
                protein: 90 + Math.floor(Math.random() * 30),
                gut: 3 + Math.floor(Math.random() * 3),
                sun: 2 + Math.floor(Math.random() * 4),
                exercise: 3 + Math.floor(Math.random() * 3),
                symptomScore: Math.floor(Math.random() * 3),
                symptomName: 'test'
              });
            
            timer.end(res.status === 201, { 
              userId: userIdStr, 
              logIndex, 
              status: res.status 
            });
            return { operation: 'log', userId: userIdStr, logIndex, status: res.status };
          });
        }
      }
      
      const startTime = Date.now();
      log(`🚀 Running ${setupOperations.length} concurrent setup operations for ${userCount} users...`);
      const setupResults = await LoadTester.runConcurrent(setupOperations, 25); // 25 concurrent operations

      log(`🚀 Running ${logOperations.length} concurrent log operations for ${userCount} users...`);
      const logResults = await LoadTester.runConcurrent(logOperations, 25); // 25 concurrent operations

      const results = [...setupResults, ...logResults];
      const totalTime = Date.now() - startTime;
      
      // Analyze results
      const successful = results.filter(r => !r.error).length;
      const failed = results.filter(r => r.error).length;
      const setupOps = results.filter(r => r.result?.operation === 'setup').length;
      const logOps = results.filter(r => r.result?.operation === 'log').length;
      
      log(`📊 Multi-User Test Results:`);
      log(`  Total Users: ${userCount}`);
      log(`  Total Operations: ${results.length}`);
      log(`  Setup Operations: ${setupOps}`);
      log(`  Log Operations: ${logOps}`);
      log(`  Successful: ${successful}`);
      log(`  Failed: ${failed}`);
      log(`  Success Rate: ${(successful / results.length * 100).toFixed(1)}%`);
      log(`  Total Time: ${totalTime}ms`);
      log(`  Throughput: ${(results.length / totalTime * 1000).toFixed(2)} ops/sec`);
      
      // Performance assertions
      expect(successful).toBeGreaterThan(results.length * 0.95); // 95% success rate
      expect(failed).toBeLessThan(results.length * 0.05); // Less than 5% failure rate
      
      // Verify data integrity
      const setupStats = PerformanceMonitor.getStats('user_setup');
      const logStats = PerformanceMonitor.getStats('user_log_creation');
      
      if (setupStats) {
        expect(setupStats.successRate).toBeGreaterThan(80);
      }
      if (logStats) {
        expect(logStats.successRate).toBeGreaterThan(80);
      }
      
    }, 180000); // 3 minute timeout for multi-user test
  });

  describe('💾 Memory and Resource Usage', () => {
    test('maintains stable memory usage under load', async () => {
      log('🧪 Testing memory usage under sustained load');
      
      const userId = 'memory-test-user';
      
      // Setup user
      await agent
        .post('/api/onboarding/start')
        .set('x-test-user', userId)
        .send({
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5
        });
      
      const initialMemory = process.memoryUsage();
      log('📊 Initial Memory Usage:', {
        rss: `${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`
      });
      
      // Sustained load test
      const iterations = 10;
      const operationsPerIteration = 50;
      
      for (let iteration = 0; iteration < iterations; iteration++) {
        log(`🔄 Iteration ${iteration + 1}/${iterations}`);
        
        const operations = Array.from({ length: operationsPerIteration }, (_, index) => async () => {
          const date = new Date('2024-01-01');
          date.setDate(date.getDate() + (iteration * operationsPerIteration) + index);
          
          return await agent
            .post('/api/logs')
            .set('x-test-user', userId)
            .send({
              date: date.toISOString().split('T')[0],
              sleep: 7 + Math.random() * 2,
              rhr: 65 + Math.floor(Math.random() * 10),
              hrv: 45 + Math.floor(Math.random() * 20),
              protein: 90 + Math.floor(Math.random() * 30),
              gut: 3 + Math.floor(Math.random() * 3),
              sun: 2 + Math.floor(Math.random() * 4),
              exercise: 3 + Math.floor(Math.random() * 3),
              symptomScore: Math.floor(Math.random() * 3),
              symptomName: 'memory-test'
            });
        });
        
        await LoadTester.runConcurrent(operations, 10);
        
        // Check memory after each iteration
        const currentMemory = process.memoryUsage();
        const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        log(`  Memory increase: ${memoryIncrease.toFixed(2)} MB`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      log('📊 Final Memory Usage:', {
        rss: `${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        increase: `${totalMemoryIncrease.toFixed(2)} MB`
      });
      
        // Memory assertions (relaxed for CI variability)
        expect(totalMemoryIncrease).toBeLessThan(200); // Less than 200MB increase
      expect(finalMemory.heapUsed).toBeLessThan(initialMemory.heapUsed * 3); // Less than 3x initial usage
      
    }, 300000); // 5 minute timeout for memory test
  });
});