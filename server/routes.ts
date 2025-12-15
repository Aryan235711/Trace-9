import type { Express, Request } from "express";
import { type Server } from "http";

// (No global Request augmentation here to avoid conflicts with passport types)
import { storage } from "./storage";
import { verifyToken, getCurrentUser, generateToken } from "./auth";
import passport from "./auth";
import { processLog, createInterventionIfNeeded, detectClusters } from "./orchestration";
import { validateDailyLogPayload } from "./validation";
import { getCachedTargets, setCachedTargets } from "./cache";
import { writeDebugArtifact } from "./debugArtifacts";
import { createRateLimiter } from "./rateLimit";
import {
  insertDailyLogSchema,
  insertUserTargetsSchema,
  insertInterventionSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
const logError = (...args: any[]) => {
  if (!isTestEnv) console.error(...args);
};

function getDateDaysAgo(dateStr: string, daysAgo: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Module load indicator for test diagnostics
if (process.env.NODE_ENV !== 'test') {
  logError('[ROUTES MODULE] routes.ts loaded');
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const writeLimiter = createRateLimiter({
    windowMs: 60_000,
    max: Number(process.env.RATE_LIMIT_WRITE_MAX || 120),
    keyPrefix: 'write',
  });

  const billingLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 20,
    keyPrefix: 'billing',
  });

  // Google Auth routes
  app.get('/api/auth/google', (req, res, next) => {
    // Check if accessing from private IP and add required parameters
    const host = req.get('host') || '';
    const isPrivateIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host);
    
    if (isPrivateIP) {
      // For private IPs, redirect to Google OAuth with device parameters
      const deviceId = 'trace9-dev-' + Date.now();
      const deviceName = encodeURIComponent('Trace9 Development');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = encodeURIComponent(`${req.protocol}://${host}/api/auth/google/callback`);
      const scope = encodeURIComponent('profile email');
      
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${scope}&` +
        `response_type=code&` +
        `device_id=${deviceId}&` +
        `device_name=${deviceName}`;
      
      return res.redirect(googleAuthUrl);
    }
    
    // For non-private IPs, use standard passport flow
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { session: false }),
    (req: any, res) => {
      try {
        const token = generateToken(req.user);
        res.redirect(`/?token=${token}`);
      } catch (error) {
        logError('Auth callback error:', error);
        res.redirect('/?error=auth_failed');
      }
    }
  );

  app.get('/api/auth/user', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      let dbUser = await storage.getUser(currentUser.userId);

      if (!dbUser) {
        dbUser = await storage.upsertUser({
          id: currentUser.userId,
          email: currentUser.email,
          firstName: currentUser.name,
          plan: 'free',
        } as any);
      }

      const plan = dbUser?.plan ?? 'free';
      res.json({ ...currentUser, plan });
    } catch (error) {
      logError("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
  });

  // Billing stub: upgrade to pro
  app.post('/api/billing/upgrade', verifyToken, billingLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });

      const updated = await storage.upsertUser({
        id: currentUser.userId,
        email: currentUser.email,
        firstName: currentUser.name,
        plan: 'pro',
      } as any);

      logError('[billing] upgrade', { userId: currentUser.userId, plan: updated.plan, at: new Date().toISOString() });
      res.json({ plan: updated.plan || 'pro' });
    } catch (error) {
      logError('Error upgrading plan:', error);
      res.status(500).json({ message: 'Failed to upgrade plan' });
    }
  });

  // Billing stub: downgrade to free
  app.post('/api/billing/downgrade', verifyToken, billingLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });

      const updated = await storage.upsertUser({
        id: currentUser.userId,
        email: currentUser.email,
        firstName: currentUser.name,
        plan: 'free',
      } as any);

      logError('[billing] downgrade', { userId: currentUser.userId, plan: updated.plan, at: new Date().toISOString() });
      res.json({ plan: updated.plan || 'free' });
    } catch (error) {
      logError('Error downgrading plan:', error);
      res.status(500).json({ message: 'Failed to downgrade plan' });
    }
  });

  // User Targets routes
  app.get('/api/targets', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      
      // Check cache first
      const cached = getCachedTargets(userId);
      if (cached) {
        return res.json(cached);
      }
      
      // Ensure user exists in database first
      await storage.upsertUser({
        id: userId,
        email: currentUser.email,
        name: currentUser.name,
      } as any);
      
      let targets = await storage.getUserTargets(userId);
      
      if (!targets) {
        // Create default targets for new users
        targets = await storage.createUserTargets({
          userId,
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5,
          sleepBaseline: null,
          rhrBaseline: null,
          hrvBaseline: null,
          isBaselineComplete: false,
          onboardingComplete: false,
          activeInterventionId: null,
        } as any);
      }
      
      // Cache the result
      setCachedTargets(userId, targets);
      res.json(targets);
    } catch (error) {
      logError("Error fetching targets:", error);
      res.status(500).json({ message: "Failed to fetch targets" });
    }
  });

  app.put('/api/targets', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      let validated: any;
      try {
        validated = insertUserTargetsSchema.omit({ userId: true }).parse(req.body);
      } catch (err: any) {
        return res.status(400).json({ message: fromZodError(err).toString() });
      }

      const targets = await storage.updateUserTargets(userId, validated);
      res.json(targets);
    } catch (error) {
      logError("Error updating targets:", error);
      res.status(500).json({ message: "Failed to update targets" });
    }
  });

  // Insights (Auto-Hypothesis) route
  app.get('/api/insights', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;

      const targets = await storage.getUserTargets(userId);
      if (!targets) {
        return res.status(400).json({ message: 'User targets not found. Please complete onboarding first.' });
      }

      if (targets.activeInterventionId) {
        return res.json({ state: 'locked', activeInterventionId: targets.activeInterventionId });
      }

      // Backfill baseline if user already has enough logs but baselines never computed.
      if (!targets.isBaselineComplete) {
        const all = await storage.getDailyLogs(userId);
        const sorted = all.slice().sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
        if (sorted.length >= 7) {
          const last7 = sorted.slice(-7);
          const sleepBaseline = last7.reduce((s: number, l: any) => s + Number(l.sleep || 0), 0) / 7;
          const rhrBaseline = last7.reduce((s: number, l: any) => s + Number(l.rhr || 0), 0) / 7;
          const hrvBaseline = last7.reduce((s: number, l: any) => s + Number(l.hrv || 0), 0) / 7;
          await storage.updateUserTargets(userId, {
            sleepBaseline,
            rhrBaseline,
            hrvBaseline,
            isBaselineComplete: true,
            onboardingComplete: true,
          } as any);
          // keep local copy consistent
          (targets as any).sleepBaseline = sleepBaseline;
          (targets as any).rhrBaseline = rhrBaseline;
          (targets as any).hrvBaseline = hrvBaseline;
          (targets as any).isBaselineComplete = true;
          (targets as any).onboardingComplete = true;
        }
      }

      if (!targets.isBaselineComplete) {
        return res.json({
          state: 'provisional',
          message: 'Gathering Data. Insights are provisional based on population averages.',
        });
      }

      const all = await storage.getDailyLogs(userId);
      const sorted = all.slice().sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
      const endDate = sorted.length ? String(sorted[sorted.length - 1].date) : new Date().toISOString().split('T')[0];
      const result = await detectClusters(userId, 7, endDate);

      return res.json({
        state: 'action-required',
        mode: result.mode || 'stagnation',
        hypothesis: result.hypothesis || 'Health patterns have plateaued. Consider introducing new wellness strategies.',
        endDate,
      });
    } catch (error: any) {
      logError('Error fetching insights:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch insights' });
    }
  });

  // Onboarding routes (backend-first)
  app.post('/api/onboarding/start', verifyToken, writeLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;

      // Optional initial targets in body
      let initialTargets: any = {};
      if (req.body && Object.keys(req.body).length > 0) {
        try {
          initialTargets = insertUserTargetsSchema.omit({ userId: true }).parse(req.body);
        } catch (err: any) {
          return res.status(400).json({ message: fromZodError(err).toString() });
        }
      }

      // Ensure user targets exist (create default if missing)
      let targets = await storage.getUserTargets(userId);
      if (!targets) {
        targets = await storage.createUserTargets({
          userId,
          proteinTarget: initialTargets.proteinTarget ?? 100,
          gutTarget: initialTargets.gutTarget ?? 5,
          sunTarget: initialTargets.sunTarget ?? 5,
          exerciseTarget: initialTargets.exerciseTarget ?? 5,
          sleepBaseline: null,
          rhrBaseline: null,
          hrvBaseline: null,
        } as any);
      } else {
        // Apply any provided target updates
        if (Object.keys(initialTargets).length > 0) {
          targets = await storage.updateUserTargets(userId, initialTargets);
        }
      }

      res.status(201).json(targets);
    } catch (error: any) {
      logError('Error starting onboarding:', error);
      res.status(500).json({ message: error.message || 'Failed to start onboarding' });
    }
  });

  app.get('/api/onboarding/status', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const targets = await storage.getUserTargets(userId);

      // Count logs over the user's most recent 7-day window based on latest available log
      const allLogs = await storage.getDailyLogs(userId);
      let daysLogged = 0;
      if (allLogs && allLogs.length > 0) {
        // find the most recent log date
        const sorted = allLogs.slice().sort((a: any, b: any) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1].date;
        const startDate = getDateDaysAgo(latest, 6); // inclusive window of 7 days ending at latest
        const windowLogs = allLogs.filter((l: any) => l.date >= startDate && l.date <= latest);
        daysLogged = windowLogs.length;
      }

      const status = {
        hasTargets: !!targets,
        isBaselineComplete: targets?.isBaselineComplete || false,
        onboardingComplete: targets?.onboardingComplete || false,
        daysLogged,
        daysRemaining: Math.max(0, 7 - daysLogged),
      };

      res.json(status);
    } catch (error: any) {
      logError('Error fetching onboarding status:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch onboarding status' });
    }
  });

  // Daily Logs routes
  app.get('/api/logs', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const { startDate, endDate } = req.query;

      // Pagination (backwards-in-time cursor):
      // - `limit`: max items to return (default 1000, max 1000)
      // - `cursor`: a YYYY-MM-DD date; returns logs strictly before this date
      const rawLimit = req.query.limit as string | undefined;
      const requestedLimit = rawLimit ? parseInt(rawLimit, 10) : 1000;
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 1000;
      const cursor = (req.query.cursor as string | undefined) || undefined;
      
      const logs = await storage.getDailyLogs(
        userId,
        startDate as string,
        endDate as string
      );

      // Normalize ordering and paginate in-memory (storage may not guarantee order).
      const sorted = (logs || []).slice().sort((a: any, b: any) => a.date.localeCompare(b.date));
      const cursorFiltered = cursor ? sorted.filter((l: any) => l.date < cursor) : sorted;

      // Take most recent `limit` logs, but return them in chronological order.
      const page = cursorFiltered.length > limit ? cursorFiltered.slice(cursorFiltered.length - limit) : cursorFiltered;
      const nextCursor = page.length > 0 ? page[0].date : null;
      if (cursorFiltered.length > page.length) {
        res.setHeader('X-Next-Cursor', String(nextCursor));
      }

      res.json(page);
    } catch (error) {
      logError("Error fetching logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.get('/api/logs/:date', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const { date } = req.params;
      
      const log = await storage.getDailyLog(userId, date);
      
      if (!log) {
        return res.status(404).json({ message: "Log not found" });
      }
      
      res.json(log);
    } catch (error) {
      logError("Error fetching log:", error);
      res.status(500).json({ message: "Failed to fetch log" });
    }
  });

  app.post('/api/logs', verifyToken, writeLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;

      writeDebugArtifact('route.logs.post.hit', userId, { method: req.method, date: req.body?.date });

      // Note: do not auto-create targets here; onboarding flow should create them.

      // Validate request body (without flags - they'll be computed)
      let validated: any;
      try {
        validated = validateDailyLogPayload({ ...req.body, userId });
      } catch (err: any) {
        return res.status(400).json({ message: err.message || fromZodError(err).toString() });
      }

      // Process the log with orchestration engine
      const processedLog = await processLog(userId, validated);
      const log = await storage.createDailyLog(processedLog);

      writeDebugArtifact('route.logs.post.persisted', userId, { date: log.date, id: (log as any).id });

      // Evaluate clusters and create intervention if needed.
      // Await here to make test behavior deterministic (ensures intervention
      // creation completes before response). Errors are caught and logged.
      try {
        writeDebugArtifact('route.logs.post.beforeCreateInterventionIfNeeded', userId, { date: log.date });
        await createInterventionIfNeeded(userId, log.date);
        writeDebugArtifact('route.logs.post.afterCreateInterventionIfNeeded', userId, { date: log.date });
      } catch (err: any) {
        writeDebugArtifact('route.logs.post.createInterventionIfNeeded.error', userId, { date: log.date, error: String(err?.message || err) });
      }

      res.status(201).json(log);
    } catch (error: any) {
      logError('Error creating log:', error);
      res.status(500).json({ message: error.message || "Failed to create log" });
    }
  });

  app.put('/api/logs/:date', verifyToken, writeLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const { date } = req.params;

      writeDebugArtifact('route.logs.put.hit', userId, { method: req.method, date });
      
      const existingLog = await storage.getDailyLog(userId, date);
      
      if (!existingLog) {
        return res.status(404).json({ message: "Log not found" });
      }
      
      // Validate request body (without flags)
      let validatedPartial: any;
      try {
        validatedPartial = validateDailyLogPayload({ ...existingLog, ...req.body });
      } catch (err: any) {
        return res.status(400).json({ message: err.message || fromZodError(err).toString() });
      }

      // Process the updated log with orchestration engine
      const processedLog = await processLog(userId, {
        ...existingLog,
        ...validatedPartial,
      });

      const log = await storage.updateDailyLog(existingLog.id, processedLog);

      writeDebugArtifact('route.logs.put.persisted', userId, { date: log.date, id: (log as any).id });

      // Re-evaluate clusters after update and await to ensure deterministic test behavior
      try {
        writeDebugArtifact('route.logs.put.beforeCreateInterventionIfNeeded', userId, { date: log.date });
        await createInterventionIfNeeded(userId, log.date);
        writeDebugArtifact('route.logs.put.afterCreateInterventionIfNeeded', userId, { date: log.date });
      } catch (err: any) {
        writeDebugArtifact('route.logs.put.createInterventionIfNeeded.error', userId, { date: log.date, error: String(err?.message || err) });
      }

      res.json(log);
    } catch (error: any) {
      logError("Error updating log:", error);
      res.status(500).json({ message: error.message || "Failed to update log" });
    }
  });

  app.delete('/api/logs/:date', verifyToken, writeLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const { date } = req.params;
      
      const log = await storage.getDailyLog(userId, date);
      
      if (!log) {
        return res.status(404).json({ message: "Log not found" });
      }
      
      await storage.deleteDailyLog(log.id);
      res.status(204).send();
    } catch (error) {
      logError("Error deleting log:", error);
      res.status(500).json({ message: "Failed to delete log" });
    }
  });

  // Interventions routes
  app.get('/api/interventions', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const interventions = await storage.getInterventions(userId);
      res.json(interventions);
    } catch (error) {
      logError("Error fetching interventions:", error);
      res.status(500).json({ message: "Failed to fetch interventions" });
    }
  });

  // Test-only debug endpoints
  if (process.env.NODE_ENV === 'test') {
    app.get('/__debug/detect', verifyToken, async (req: any, res) => {
      try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
        const userId = currentUser.userId;
        const endDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
        const startDate = getDateDaysAgo(endDate, 7);

        writeDebugArtifact('debug.detect.hit', userId, { endDate, startDate });

        const result = await detectClusters(userId, 3, endDate);
        const logs = await storage.getDailyLogs(userId, startDate, endDate);
        const targets = await storage.getUserTargets(userId);
        const interventions = await storage.getInterventions(userId);
        const state = (storage as any)._getState ? (storage as any)._getState() : null;

        writeDebugArtifact('debug.detect.response', userId, {
          endDate,
          startDate,
          result,
          logsCount: logs.length,
          interventionsCount: interventions.length,
          activeInterventionId: (targets as any)?.activeInterventionId ?? null,
        });

        res.json({
          window: { startDate, endDate },
          result,
          logs: logs.slice().sort((a: any, b: any) => a.date.localeCompare(b.date)),
          targets,
          interventions,
          state,
        });
      } catch (err: any) {
        writeDebugArtifact('debug.detect.error', 'unknown', { error: String(err?.message || err) });
        res.status(500).json({ message: 'debug failed' });
      }
    });
  }

  app.get('/api/interventions/active', verifyToken, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const targets = await storage.getUserTargets(userId);
      const activeId = (targets as any)?.activeInterventionId as string | null | undefined;
      if (activeId) {
        const all = await storage.getInterventions(userId);
        const active = all.find((i: any) => i.id === activeId) || null;
        return res.json(active);
      }

      const intervention = await storage.getActiveIntervention(userId);
      res.json(intervention || null);
    } catch (error) {
      logError("Error fetching active intervention:", error);
      res.status(500).json({ message: "Failed to fetch active intervention" });
    }
  });

  app.post('/api/interventions', verifyToken, writeLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      let validated: any;
      try {
        const payload = { ...req.body, userId };
        // Convert date strings to Date objects if needed
        if (payload.startDate && typeof payload.startDate === 'string') {
          payload.startDate = new Date(payload.startDate);
        }
        if (payload.endDate && typeof payload.endDate === 'string') {
          payload.endDate = new Date(payload.endDate);
        }
        validated = insertInterventionSchema.parse(payload);
      } catch (err: any) {
        return res.status(400).json({ message: fromZodError(err).toString() });
      }

      // Dedupe protection: prevent duplicate hypothesis text
      // Overlap protection: only block overlap with the *currently active* intervention (if any)
      const all = await storage.getInterventions(userId);
      const targets = await storage.getUserTargets(userId);
      const activeId = (targets as any)?.activeInterventionId as string | null | undefined;
      const activeIntervention = activeId ? all.find((i: any) => i.id === activeId) : null;
      const newStart = new Date(String(validated.startDate));
      const newEnd = new Date(String(validated.endDate));
      const normalizedHypothesis = String(validated.hypothesisText || '').trim().toLowerCase();

      for (const ex of all) {
        const exHyp = String(ex.hypothesisText || '').trim().toLowerCase();
        if (exHyp && exHyp === normalizedHypothesis) {
          return res.status(400).json({ message: 'An intervention with the same hypothesis already exists' });
        }
      }

      if (activeIntervention && !activeIntervention.result) {
        const exStart = new Date(String(activeIntervention.startDate));
        const exEnd = new Date(String(activeIntervention.endDate));
        const overlaps = !(newEnd < exStart || newStart > exEnd);
        if (overlaps) {
          return res.status(400).json({ message: 'An overlapping active intervention already exists' });
        }
      }

      const intervention = await storage.createIntervention(validated);

      // Make the newly created intervention the active one (if targets exist)
      if (targets) {
        await storage.updateUserTargets(userId, { activeInterventionId: (intervention as any).id } as any);
      }
      res.status(201).json(intervention);
    } catch (error) {
      logError("Error creating intervention:", error);
      res.status(500).json({ message: "Failed to create intervention" });
    }
  });

  app.put('/api/interventions/:id', verifyToken, writeLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const { id } = req.params;
      
      const intervention = await storage.getIntervention(id);
      
      if (!intervention) {
        return res.status(404).json({ message: "Intervention not found" });
      }
      
      if (intervention.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      // Merge existing intervention with incoming fields and validate full payload
      let validatedFull: any;
      try {
        const payload = { ...intervention, ...req.body };
        // Convert date strings to Date objects if needed
        if (payload.startDate && typeof payload.startDate === 'string') {
          payload.startDate = new Date(payload.startDate);
        }
        if (payload.endDate && typeof payload.endDate === 'string') {
          payload.endDate = new Date(payload.endDate);
        }
        validatedFull = insertInterventionSchema.parse(payload);
      } catch (err: any) {
        return res.status(400).json({ message: fromZodError(err).toString() });
      }

      const updated = await storage.updateIntervention(id, validatedFull);
      res.json(updated);
    } catch (error) {
      logError("Error updating intervention:", error);
      res.status(500).json({ message: "Failed to update intervention" });
    }
  });

  // Complete / Check-in for an intervention after its scheduled endDate
  app.post('/api/interventions/:id/checkin', verifyToken, writeLimiter, async (req: any, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) return res.status(401).json({ message: 'Not authenticated' });
      const userId = currentUser.userId;
      const { id } = req.params;

      const intervention = await storage.getIntervention(id);
      if (!intervention) return res.status(404).json({ message: 'Intervention not found' });
      if (intervention.userId !== userId) return res.status(403).json({ message: 'Forbidden' });

      // Ensure the intervention period has completed
      const now = new Date();
      const end = new Date(String(intervention.endDate));
      if (now < end) {
        return res.status(400).json({ message: 'Intervention period not yet complete' });
      }

      // Validate result
      const { result } = req.body as { result?: string };
      const allowed = ['Yes', 'No', 'Partial'];
      if (!result || !allowed.includes(result)) {
        return res.status(400).json({ message: '`result` must be one of Yes, No, Partial' });
      }

      // Mark intervention completed and clear user's activeInterventionId if it matches
      const updated = await storage.updateIntervention(id, { result, completedAt: new Date() } as any);

      // If user's activeInterventionId points to this intervention, clear it
      const targets = await storage.getUserTargets(userId);
      if (targets && targets.activeInterventionId === id) {
        await storage.updateUserTargets(userId, { activeInterventionId: null as any });
      }

      res.json(updated);
    } catch (error: any) {
      logError('Error completing intervention:', error);
      res.status(500).json({ message: error.message || 'Failed to complete intervention' });
    }
  });

  return httpServer;
}
