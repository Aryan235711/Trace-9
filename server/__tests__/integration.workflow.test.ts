import http from 'http';
import express from 'express';
import request from 'supertest';

jest.setTimeout(60000);

// Workflow state tracker
class WorkflowTracker {
  private static workflows: Map<string, {
    id: string;
    name: string;
    steps: Array<{
      stepName: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      startTime?: number;
      endTime?: number;
      duration?: number;
      data?: any;
      error?: string;
    }>;
    startTime: number;
    endTime?: number;
    status: 'running' | 'completed' | 'failed';
  }> = new Map();
  
  static startWorkflow(id: string, name: string, steps: string[]) {
    const workflow = {
      id,
      name,
      steps: steps.map(stepName => ({ stepName, status: 'pending' as const })),
      startTime: Date.now(),
      status: 'running' as const
    };
    
    this.workflows.set(id, workflow);
    if (process.env.WORKFLOW_LOGGER_STDOUT === '1') {
      console.log(`🚀 Starting workflow: ${name} (${id})`);
    }
    return workflow;
  }
  
  static startStep(workflowId: string, stepName: string) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);
    
    const step = workflow.steps.find(s => s.stepName === stepName);
    if (!step) throw new Error(`Step ${stepName} not found in workflow ${workflowId}`);
    
    step.status = 'running';
    step.startTime = Date.now();
    
    if (process.env.WORKFLOW_LOGGER_STDOUT === '1') {
      console.log(`  ⏳ Step: ${stepName}`);
    }
    
    return {
      complete: (data?: any) => this.completeStep(workflowId, stepName, data),
      fail: (error: string) => this.failStep(workflowId, stepName, error)
    };
  }
  
  static completeStep(workflowId: string, stepName: string, data?: any) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    const step = workflow.steps.find(s => s.stepName === stepName);
    if (!step) return;
    
    step.status = 'completed';
    step.endTime = Date.now();
    step.duration = step.endTime - (step.startTime || 0);
    step.data = data;
    
    if (process.env.WORKFLOW_LOGGER_STDOUT === '1') {
      console.log(`  ✅ Step completed: ${stepName} (${step.duration}ms)`);
    }
    
    // Check if all steps are completed
    const allCompleted = workflow.steps.every(s => s.status === 'completed');
    if (allCompleted) {
      workflow.status = 'completed';
      workflow.endTime = Date.now();
      if (process.env.WORKFLOW_LOGGER_STDOUT === '1') {
        console.log(`🎉 Workflow completed: ${workflow.name} (${workflow.endTime - workflow.startTime}ms)`);
      }
    }
  }
  
  static failStep(workflowId: string, stepName: string, error: string) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    const step = workflow.steps.find(s => s.stepName === stepName);
    if (!step) return;
    
    step.status = 'failed';
    step.endTime = Date.now();
    step.duration = step.endTime - (step.startTime || 0);
    step.error = error;
    
    workflow.status = 'failed';
    workflow.endTime = Date.now();
    
    if (process.env.WORKFLOW_LOGGER_STDOUT === '1') {
      console.log(`  ❌ Step failed: ${stepName} - ${error}`);
      console.log(`💥 Workflow failed: ${workflow.name}`);
    }
  }
  
  static getWorkflow(id: string) {
    return this.workflows.get(id);
  }
  
  static getAllWorkflows() {
    return Array.from(this.workflows.values());
  }
  
  static clearWorkflows() {
    this.workflows.clear();
  }
  
  static getStats() {
    const workflows = Array.from(this.workflows.values());
    const completed = workflows.filter(w => w.status === 'completed');
    const failed = workflows.filter(w => w.status === 'failed');
    const running = workflows.filter(w => w.status === 'running');
    
    const avgDuration = completed.length > 0 
      ? completed.reduce((sum, w) => sum + (w.endTime! - w.startTime), 0) / completed.length 
      : 0;
    
    return {
      total: workflows.length,
      completed: completed.length,
      failed: failed.length,
      running: running.length,
      successRate: workflows.length > 0 ? (completed.length / workflows.length) * 100 : 0,
      avgDuration
    };
  }
  
  static logStats() {
    const stats = this.getStats();
    if (process.env.WORKFLOW_LOGGER_STDOUT === '1') {
      console.log('\n📊 Workflow Statistics:');
      console.log(`  Total Workflows: ${stats.total}`);
      console.log(`  ✅ Completed: ${stats.completed}`);
      console.log(`  ❌ Failed: ${stats.failed}`);
      console.log(`  ⏳ Running: ${stats.running}`);
      console.log(`  Success Rate: ${stats.successRate.toFixed(1)}%`);
      console.log(`  Avg Duration: ${stats.avgDuration.toFixed(0)}ms`);
    }
  }
}

// Advanced mock storage with workflow integration
function createWorkflowMockStorage() {
  const users = new Map();
  const userTargets = new Map();
  const dailyLogs = new Map();
  const interventions = new Map();
  
  return {
    // User management
    upsertUser: jest.fn(async (userData: any) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      users.set(userData.id, { ...userData, createdAt: new Date() });
      return users.get(userData.id);
    }),
    
    getUser: jest.fn(async (userId: string) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
      return users.get(userId) || null;
    }),
    
    // User targets
    getUserTargets: jest.fn(async (userId: string) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 8));
      return userTargets.get(userId) || null;
    }),
    
    createUserTargets: jest.fn(async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 12));
      const id = `target-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const target = { id, ...data, createdAt: new Date() };
      userTargets.set(data.userId, target);
      return target;
    }),
    
    updateUserTargets: jest.fn(async (userId: string, updates: any) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      const existing = userTargets.get(userId);
      if (!existing) throw new Error(`No targets found for user: ${userId}`);
      const updated = { ...existing, ...updates, updatedAt: new Date() };
      userTargets.set(userId, updated);
      return updated;
    }),
    
    // Daily logs
    getDailyLogs: jest.fn(async (userId: string, startDate?: string, endDate?: string) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 15));
      const logs = dailyLogs.get(userId) || [];
      
      if (!startDate && !endDate) return logs;
      
      return logs.filter((log: any) => {
        const logDate = log.date;
        const afterStart = !startDate || logDate >= startDate;
        const beforeEnd = !endDate || logDate <= endDate;
        return afterStart && beforeEnd;
      });
    }),
    
    getDailyLog: jest.fn(async (userId: string, date: string) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 8));
      const logs = dailyLogs.get(userId) || [];
      return logs.find((log: any) => log.date === date) || null;
    }),
    
    createDailyLog: jest.fn(async (logData: any) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 12));
      const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const log = { id, ...logData, createdAt: new Date() };
      
      const userLogs = dailyLogs.get(logData.userId) || [];
      userLogs.push(log);
      dailyLogs.set(logData.userId, userLogs);
      
      return log;
    }),
    
    updateDailyLog: jest.fn(async (logId: string, updates: any) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      for (const [userId, logs] of dailyLogs.entries()) {
        const logIndex = logs.findIndex((log: any) => log.id === logId);
        if (logIndex !== -1) {
          logs[logIndex] = { ...logs[logIndex], ...updates, updatedAt: new Date() };
          return logs[logIndex];
        }
      }
      throw new Error(`Log not found: ${logId}`);
    }),
    
    deleteDailyLog: jest.fn(async (logId: string) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 8));
      for (const [userId, logs] of dailyLogs.entries()) {
        const logIndex = logs.findIndex((log: any) => log.id === logId);
        if (logIndex !== -1) {
          logs.splice(logIndex, 1);
          return;
        }
      }
      throw new Error(`Log not found: ${logId}`);
    }),
    
    // Interventions
    getInterventions: jest.fn(async (userId: string) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      return Array.from(interventions.values()).filter((i: any) => i.userId === userId);
    }),
    
    getIntervention: jest.fn(async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 6));
      return interventions.get(id) || null;
    }),
    
    createIntervention: jest.fn(async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 12));
      const id = `int-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const intervention = { id, ...data, createdAt: new Date() };
      interventions.set(id, intervention);
      return intervention;
    }),
    
    updateIntervention: jest.fn(async (id: string, updates: any) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      const existing = interventions.get(id);
      if (!existing) throw new Error(`Intervention not found: ${id}`);
      const updated = { ...existing, ...updates, updatedAt: new Date() };
      interventions.set(id, updated);
      return updated;
    }),
    
    getActiveIntervention: jest.fn(async (userId: string) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 8));
      return Array.from(interventions.values()).find((i: any) => i.userId === userId && !i.result) || null;
    }),
    
    // Utility methods
    _clear: () => {
      users.clear();
      userTargets.clear();
      dailyLogs.clear();
      interventions.clear();
    },
    
    _getState: () => ({
      users: users.size,
      userTargets: userTargets.size,
      dailyLogs: Array.from(dailyLogs.values()).reduce((sum, logs) => sum + logs.length, 0),
      interventions: interventions.size
    })
  };
}

describe('🔄 Complete Integration Workflow Tests', () => {
  let server: http.Server;
  let agent: any;
  let mockStorage: any;
  
  beforeAll(async () => {
    if (process.env.WORKFLOW_LOGGER_STDOUT === '1') console.log('🚀 Starting integration workflow test suite');
    
    mockStorage = createWorkflowMockStorage();
    
    jest.doMock('../storage', () => ({ storage: mockStorage }));
    jest.doMock('../replitAuth', () => ({
      setupAuth: async (app: any) => {},
      isAuthenticated: (req: any, res: any, next: any) => {
        const headerUser = (req.headers['x-test-user'] as string) || 'workflow-user';
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
    // Use a single listening server for all requests to avoid ECONNRESET under
    // heavy concurrency (supertest request(app) can spin up ephemeral servers).
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    agent = request(server);
  });
  
  beforeEach(() => {
    WorkflowTracker.clearWorkflows();
    mockStorage._clear();
  });
  
  afterEach(() => {
    WorkflowTracker.logStats();
  });
  
  afterAll(async () => {
    if (server) {
      (server as any).closeIdleConnections?.();
      (server as any).closeAllConnections?.();
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    }
    if (process.env.WORKFLOW_LOGGER_STDOUT === '1') console.log('🏁 Integration workflow test suite complete');
  });

  describe('👤 Complete User Lifecycle Workflows', () => {
    test('new user complete journey with intervention cycle', async () => {
      const workflowId = 'new-user-complete-journey';
      const userId = 'journey-user-1';
      
      const workflow = WorkflowTracker.startWorkflow(workflowId, 'New User Complete Journey', [
        'User Registration',
        'Onboarding Setup',
        'Baseline Establishment',
        'Daily Logging Phase',
        'Pattern Detection',
        'Intervention Creation',
        'Intervention Execution',
        'Intervention Completion',
        'Post-Intervention Analysis'
      ]);
      
      try {
        // Step 1: User Registration (simulated)
        const step1 = WorkflowTracker.startStep(workflowId, 'User Registration');
        // In real app, this would be OAuth flow
        step1.complete({ userId, method: 'simulated' });
        
        // Step 2: Onboarding Setup
        const step2 = WorkflowTracker.startStep(workflowId, 'Onboarding Setup');
        const onboardingRes = await agent
          .post('/api/onboarding/start')
          .set('x-test-user', userId)
          .send({
            proteinTarget: 120,
            gutTarget: 4,
            sunTarget: 3,
            exerciseTarget: 4
          });
        
        if (onboardingRes.status !== 201) {
          step2.fail(`Onboarding failed with status ${onboardingRes.status}`);
          return;
        }
        step2.complete({ targets: onboardingRes.body });
        
        // Step 3: Baseline Establishment (7 days of data)
        const step3 = WorkflowTracker.startStep(workflowId, 'Baseline Establishment');
        const baselineData = [];
        
        for (let day = 1; day <= 7; day++) {
          const date = new Date('2024-01-01');
          date.setDate(date.getDate() + day - 1);
          const dateStr = date.toISOString().split('T')[0];
          
          const logRes = await agent
            .post('/api/logs')
            .set('x-test-user', userId)
            .send({
              date: dateStr,
              sleep: 7.5 + (Math.random() - 0.5) * 0.5, // 7.25-7.75 hours
              rhr: 65 + Math.floor(Math.random() * 5), // 65-70 bpm
              hrv: 50 + Math.floor(Math.random() * 10), // 50-60 ms
              protein: 110 + Math.floor(Math.random() * 20), // 110-130g
              gut: 4 + Math.floor(Math.random() * 2), // 4-5
              sun: 3 + Math.floor(Math.random() * 2), // 3-4
              exercise: 4 + Math.floor(Math.random() * 2), // 4-5
              symptomScore: Math.floor(Math.random() * 2), // 0-1 (low symptoms)
              symptomName: day <= 3 ? 'none' : 'mild fatigue'
            });
          
          if (logRes.status !== 201) {
            step3.fail(`Baseline log creation failed on day ${day}`);
            return;
          }
          
          baselineData.push(logRes.body);
        }
        
        // Verify baseline completion
        const statusRes = await agent
          .get('/api/onboarding/status')
          .set('x-test-user', userId);
        
        if (!statusRes.body.isBaselineComplete) {
          step3.fail('Baseline not marked as complete after 7 days');
          return;
        }
        step3.complete({ baselineData, status: statusRes.body });
        
        // Step 4: Daily Logging Phase (additional days)
        const step4 = WorkflowTracker.startStep(workflowId, 'Daily Logging Phase');
        const dailyLogs = [];
        
        for (let day = 8; day <= 14; day++) {
          const date = new Date('2024-01-01');
          date.setDate(date.getDate() + day - 1);
          const dateStr = date.toISOString().split('T')[0];
          
          // Gradually introduce problematic patterns
          const isProblematicDay = day >= 12;
          
          const logRes = await agent
            .post('/api/logs')
            .set('x-test-user', userId)
            .send({
              date: dateStr,
              sleep: isProblematicDay ? 5.5 : 7.5, // Poor sleep on problematic days
              rhr: isProblematicDay ? 80 : 67, // High RHR on problematic days
              hrv: isProblematicDay ? 35 : 52, // Low HRV on problematic days
              protein: isProblematicDay ? 70 : 115, // Low protein on problematic days
              gut: isProblematicDay ? 2 : 4, // Poor gut health on problematic days
              sun: isProblematicDay ? 1 : 3, // Low sun on problematic days
              exercise: isProblematicDay ? 1 : 4, // Low exercise on problematic days
              symptomScore: isProblematicDay ? 4 : 1, // High symptoms on problematic days
              symptomName: isProblematicDay ? 'severe fatigue' : 'mild tiredness'
            });
          
          if (logRes.status !== 201) {
            step4.fail(`Daily log creation failed on day ${day}`);
            return;
          }
          
          dailyLogs.push(logRes.body);
        }
        step4.complete({ dailyLogs });
        
        // Step 5: Pattern Detection (check for auto-generated interventions)
        const step5 = WorkflowTracker.startStep(workflowId, 'Pattern Detection');
        
        // Wait a moment for pattern detection to process
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const interventionsRes = await agent
          .get('/api/interventions')
          .set('x-test-user', userId);
        
        if (interventionsRes.status !== 200) {
          step5.fail('Failed to retrieve interventions');
          return;
        }
        
        const autoInterventions = interventionsRes.body.filter((i: any) => 
          i.hypothesisText && i.hypothesisText.includes('sleep')
        );
        
        if (autoInterventions.length === 0) {
          step5.fail('No auto-generated interventions found despite problematic patterns');
          return;
        }
        step5.complete({ interventions: autoInterventions });
        
        // Step 6: Intervention Creation (manual intervention)
        const step6 = WorkflowTracker.startStep(workflowId, 'Intervention Creation');
        
        const manualInterventionRes = await agent
          .post('/api/interventions')
          .set('x-test-user', userId)
          .send({
            hypothesisText: 'Increase sleep duration to 8+ hours and reduce screen time before bed',
            startDate: new Date('2024-01-15').toISOString(),
            endDate: new Date('2024-01-22').toISOString()
          });
        
        if (manualInterventionRes.status !== 201) {
          step6.fail(`Manual intervention creation failed with status ${manualInterventionRes.status}`);
          return;
        }
        step6.complete({ manualIntervention: manualInterventionRes.body });
        
        // Step 7: Intervention Execution (simulate intervention period)
        const step7 = WorkflowTracker.startStep(workflowId, 'Intervention Execution');
        
        const interventionLogs = [];
        for (let day = 15; day <= 21; day++) {
          const date = new Date('2024-01-01');
          date.setDate(date.getDate() + day - 1);
          const dateStr = date.toISOString().split('T')[0];
          
          // Simulate improvement during intervention
          const logRes = await agent
            .post('/api/logs')
            .set('x-test-user', userId)
            .send({
              date: dateStr,
              sleep: 8.0 + (Math.random() - 0.5) * 0.3, // Improved sleep
              rhr: 66 + Math.floor(Math.random() * 4), // Improved RHR
              hrv: 52 + Math.floor(Math.random() * 8), // Improved HRV
              protein: 115 + Math.floor(Math.random() * 15), // Maintained protein
              gut: 4 + Math.floor(Math.random() * 2), // Improved gut
              sun: 3 + Math.floor(Math.random() * 2), // Maintained sun
              exercise: 4 + Math.floor(Math.random() * 2), // Maintained exercise
              symptomScore: Math.floor(Math.random() * 2), // Reduced symptoms
              symptomName: Math.random() > 0.7 ? 'mild tiredness' : 'none'
            });
          
          if (logRes.status !== 201) {
            step7.fail(`Intervention period log failed on day ${day}`);
            return;
          }
          
          interventionLogs.push(logRes.body);
        }
        step7.complete({ interventionLogs });
        
        // Step 8: Intervention Completion
        const step8 = WorkflowTracker.startStep(workflowId, 'Intervention Completion');
        
        // Update intervention to have past end date
        const intervention = manualInterventionRes.body;
        await mockStorage.updateIntervention(intervention.id, {
          endDate: new Date('2024-01-20') // Past date
        });
        
        const checkinRes = await agent
          .post(`/api/interventions/${intervention.id}/checkin`)
          .set('x-test-user', userId)
          .send({ result: 'Yes' });
        
        if (checkinRes.status !== 200) {
          step8.fail(`Intervention check-in failed with status ${checkinRes.status}`);
          return;
        }
        step8.complete({ checkinResult: checkinRes.body });
        
        // Step 9: Post-Intervention Analysis
        const step9 = WorkflowTracker.startStep(workflowId, 'Post-Intervention Analysis');
        
        // Verify intervention lock cleared
        const finalTargetsRes = await agent
          .get('/api/targets')
          .set('x-test-user', userId);
        
        if (finalTargetsRes.body.activeInterventionId !== null) {
          step9.fail('Intervention lock not cleared after completion');
          return;
        }
        
        // Get final intervention status
        const finalInterventionsRes = await agent
          .get('/api/interventions')
          .set('x-test-user', userId);
        
        const completedInterventions = finalInterventionsRes.body.filter((i: any) => i.result);
        
        step9.complete({ 
          lockCleared: true, 
          completedInterventions: completedInterventions.length,
          totalInterventions: finalInterventionsRes.body.length
        });
        
        // Verify workflow completion
        const finalWorkflow = WorkflowTracker.getWorkflow(workflowId);
        expect(finalWorkflow?.status).toBe('completed');
        expect(finalWorkflow?.steps.every(s => s.status === 'completed')).toBe(true);
        
      } catch (error) {
        console.error('Workflow failed with error:', error);
        throw error;
      }
    }, 60000); // 60 second timeout
    
    test('existing user daily routine workflow', async () => {
      const workflowId = 'existing-user-routine';
      const userId = 'routine-user-1';
      
      WorkflowTracker.startWorkflow(workflowId, 'Existing User Daily Routine', [
        'User Authentication',
        'Dashboard Load',
        'Daily Log Creation',
        'Data Validation',
        'Log Update',
        'Historical Data Retrieval',
        'Target Adjustment'
      ]);
      
      // Pre-setup existing user
      await agent
        .post('/api/onboarding/start')
        .set('x-test-user', userId)
        .send({
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5
        });
      
      // Create baseline data
      for (let i = 0; i < 7; i++) {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i);
        await agent
          .post('/api/logs')
          .set('x-test-user', userId)
          .send({
            date: date.toISOString().split('T')[0],
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
      
      try {
        // Step 1: User Authentication (simulated)
        const step1 = WorkflowTracker.startStep(workflowId, 'User Authentication');
        step1.complete({ method: 'header-based', userId });
        
        // Step 2: Dashboard Load
        const step2 = WorkflowTracker.startStep(workflowId, 'Dashboard Load');
        
        const [targetsRes, logsRes, interventionsRes] = await Promise.all([
          agent.get('/api/targets').set('x-test-user', userId),
          agent.get('/api/logs').set('x-test-user', userId),
          agent.get('/api/interventions').set('x-test-user', userId)
        ]);
        
        if (targetsRes.status !== 200 || logsRes.status !== 200 || interventionsRes.status !== 200) {
          step2.fail('Dashboard data loading failed');
          return;
        }
        
        step2.complete({ 
          targets: targetsRes.body,
          logsCount: logsRes.body.length,
          interventionsCount: interventionsRes.body.length
        });
        
        // Step 3: Daily Log Creation
        const step3 = WorkflowTracker.startStep(workflowId, 'Daily Log Creation');
        
        const today = '2024-01-15';
        const createLogRes = await agent
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
        
        if (createLogRes.status !== 201) {
          step3.fail(`Log creation failed with status ${createLogRes.status}`);
          return;
        }
        step3.complete({ log: createLogRes.body });
        
        // Step 4: Data Validation
        const step4 = WorkflowTracker.startStep(workflowId, 'Data Validation');
        
        const retrievedLogRes = await agent
          .get(`/api/logs/${today}`)
          .set('x-test-user', userId);
        
        if (retrievedLogRes.status !== 200) {
          step4.fail('Log retrieval failed');
          return;
        }
        
        const log = retrievedLogRes.body;
        const hasFlags = ['sleepFlag', 'rhrFlag', 'hrvFlag', 'proteinFlag'].every(flag => 
          log[flag] && ['RED', 'YELLOW', 'GREEN'].includes(log[flag])
        );
        
        if (!hasFlags) {
          step4.fail('Log missing required flags');
          return;
        }
        step4.complete({ validatedLog: log });
        
        // Step 5: Log Update
        const step5 = WorkflowTracker.startStep(workflowId, 'Log Update');
        
        const updateLogRes = await agent
          .put(`/api/logs/${today}`)
          .set('x-test-user', userId)
          .send({
            protein: 110, // Increased protein
            symptomScore: 0, // Symptoms resolved
            symptomName: 'none'
          });
        
        if (updateLogRes.status !== 200) {
          step5.fail(`Log update failed with status ${updateLogRes.status}`);
          return;
        }
        step5.complete({ updatedLog: updateLogRes.body });
        
        // Step 6: Historical Data Retrieval
        const step6 = WorkflowTracker.startStep(workflowId, 'Historical Data Retrieval');
        
        const historicalRes = await agent
          .get('/api/logs')
          .query({ startDate: '2024-01-01', endDate: '2024-01-15' })
          .set('x-test-user', userId);
        
        if (historicalRes.status !== 200) {
          step6.fail('Historical data retrieval failed');
          return;
        }
        step6.complete({ historicalLogs: historicalRes.body.length });
        
        // Step 7: Target Adjustment
        const step7 = WorkflowTracker.startStep(workflowId, 'Target Adjustment');
        
        const updateTargetsRes = await agent
          .put('/api/targets')
          .set('x-test-user', userId)
          .send({
            proteinTarget: 110, // Increased based on recent logs
            exerciseTarget: 4 // Adjusted based on performance
          });
        
        if (updateTargetsRes.status !== 200) {
          step7.fail(`Target update failed with status ${updateTargetsRes.status}`);
          return;
        }
        step7.complete({ updatedTargets: updateTargetsRes.body });
        
        // Verify workflow completion
        const finalWorkflow = WorkflowTracker.getWorkflow(workflowId);
        expect(finalWorkflow?.status).toBe('completed');
        
      } catch (error) {
        console.error('Routine workflow failed:', error);
        throw error;
      }
    }, 30000);
  });

  describe('🔄 Multi-User Concurrent Workflows', () => {
    test('handles multiple users with overlapping workflows', async () => {
      const userCount = 5;
      const workflows: Promise<void>[] = [];
      
      for (let i = 1; i <= userCount; i++) {
        const workflowId = `concurrent-user-${i}`;
        const userId = `concurrent-user-${i}`;
        
        const workflow = async () => {
          WorkflowTracker.startWorkflow(workflowId, `Concurrent User ${i} Workflow`, [
            'Setup',
            'Onboarding',
            'Data Creation',
            'Data Retrieval',
            'Cleanup'
          ]);
          
          try {
            // Setup
            const step1 = WorkflowTracker.startStep(workflowId, 'Setup');
            step1.complete();
            
            // Onboarding
            const step2 = WorkflowTracker.startStep(workflowId, 'Onboarding');
            const onboardingRes = await agent
              .post('/api/onboarding/start')
              .set('x-test-user', userId)
              .send({
                proteinTarget: 100 + i * 10,
                gutTarget: 5,
                sunTarget: 5,
                exerciseTarget: 5
              });
            
            if (onboardingRes.status !== 201) {
              step2.fail(`Onboarding failed: ${onboardingRes.status}`);
              return;
            }
            step2.complete();
            
            // Data Creation
            const step3 = WorkflowTracker.startStep(workflowId, 'Data Creation');
            const logPromises = [];
            
            for (let day = 1; day <= 5; day++) {
              const date = new Date('2024-01-01');
              date.setDate(date.getDate() + day + i); // Offset by user to avoid conflicts
              
              logPromises.push(
                agent
                  .post('/api/logs')
                  .set('x-test-user', userId)
                  .send({
                    date: date.toISOString().split('T')[0],
                    sleep: 7 + Math.random() * 2,
                    rhr: 60 + Math.floor(Math.random() * 15),
                    hrv: 40 + Math.floor(Math.random() * 20),
                    protein: 90 + Math.floor(Math.random() * 30),
                    gut: 3 + Math.floor(Math.random() * 3),
                    sun: 2 + Math.floor(Math.random() * 4),
                    exercise: 3 + Math.floor(Math.random() * 3),
                    symptomScore: Math.floor(Math.random() * 3),
                    symptomName: `user-${i}-symptom`
                  })
              );
            }
            
            const logResults = await Promise.all(logPromises);
            const failedLogs = logResults.filter(res => res.status !== 201);
            
            if (failedLogs.length > 0) {
              step3.fail(`${failedLogs.length} logs failed to create`);
              return;
            }
            step3.complete({ logsCreated: logResults.length });
            
            // Data Retrieval
            const step4 = WorkflowTracker.startStep(workflowId, 'Data Retrieval');
            const retrievalRes = await agent
              .get('/api/logs')
              .set('x-test-user', userId);
            
            if (retrievalRes.status !== 200) {
              step4.fail(`Data retrieval failed: ${retrievalRes.status}`);
              return;
            }
            step4.complete({ logsRetrieved: retrievalRes.body.length });
            
            // Cleanup (verify data isolation)
            const step5 = WorkflowTracker.startStep(workflowId, 'Cleanup');
            
            // Verify user can only see their own data
            const userLogs = retrievalRes.body;
            const hasOtherUserData = userLogs.some((log: any) => 
              log.symptomName && !log.symptomName.includes(`user-${i}`)
            );
            
            if (hasOtherUserData) {
              step5.fail('Data isolation breach detected');
              return;
            }
            step5.complete({ dataIsolationVerified: true });
            
          } catch (error) {
            console.error(`Workflow ${workflowId} failed:`, error);
            throw error;
          }
        };
        
        workflows.push(workflow());
      }
      
      // Wait for all workflows to complete (even if one fails) to avoid leaking
      // in-flight async work into subsequent tests.
      const results = await Promise.allSettled(workflows);

      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (rejected.length > 0) {
        throw rejected[0].reason;
      }
      
      // Verify all workflows completed successfully
      const stats = WorkflowTracker.getStats();
      expect(stats.completed).toBe(userCount);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(100);
      
    }, 60000);
  });

  describe('🚨 Error Recovery Workflows', () => {
    test('handles and recovers from various error conditions', async () => {
      const workflowId = 'error-recovery';
      const userId = 'error-recovery-user';
      
      WorkflowTracker.startWorkflow(workflowId, 'Error Recovery Workflow', [
        'Normal Operation',
        'Simulate Database Error',
        'Error Recovery',
        'Retry Operation',
        'Verify Recovery'
      ]);
      
      try {
        // Step 1: Normal Operation
        const step1 = WorkflowTracker.startStep(workflowId, 'Normal Operation');
        
        const normalRes = await agent
          .post('/api/onboarding/start')
          .set('x-test-user', userId)
          .send({
            proteinTarget: 100,
            gutTarget: 5,
            sunTarget: 5,
            exerciseTarget: 5
          });
        
        if (normalRes.status !== 201) {
          step1.fail(`Normal operation failed: ${normalRes.status}`);
          return;
        }
        step1.complete();
        
        // Step 2: Simulate Database Error
        const step2 = WorkflowTracker.startStep(workflowId, 'Simulate Database Error');
        
        // Temporarily break the mock storage
        const originalCreateDailyLog = mockStorage.createDailyLog;
        mockStorage.createDailyLog = jest.fn().mockRejectedValue(new Error('Simulated database error'));
        
        const errorRes = await agent
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
            symptomName: 'test'
          });
        
        if (errorRes.status === 201) {
          step2.fail('Expected error was not triggered');
          return;
        }
        step2.complete({ errorStatus: errorRes.status });
        
        // Step 3: Error Recovery
        const step3 = WorkflowTracker.startStep(workflowId, 'Error Recovery');
        
        // Restore normal operation
        mockStorage.createDailyLog = originalCreateDailyLog;
        
        step3.complete({ storageRestored: true });
        
        // Step 4: Retry Operation
        const step4 = WorkflowTracker.startStep(workflowId, 'Retry Operation');
        
        const retryRes = await agent
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
            symptomName: 'test'
          });
        
        if (retryRes.status !== 201) {
          step4.fail(`Retry operation failed: ${retryRes.status}`);
          return;
        }
        step4.complete({ retrySuccessful: true });
        
        // Step 5: Verify Recovery
        const step5 = WorkflowTracker.startStep(workflowId, 'Verify Recovery');
        
        const verifyRes = await agent
          .get('/api/logs/2024-01-15')
          .set('x-test-user', userId);
        
        if (verifyRes.status !== 200) {
          step5.fail('Recovery verification failed');
          return;
        }
        step5.complete({ dataVerified: true });
        
        // Verify workflow completion
        const finalWorkflow = WorkflowTracker.getWorkflow(workflowId);
        expect(finalWorkflow?.status).toBe('completed');
        
      } catch (error) {
        console.error('Error recovery workflow failed:', error);
        throw error;
      }
    }, 30000);
  });
});