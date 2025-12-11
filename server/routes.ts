import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processLog, createInterventionIfNeeded, getDateDaysAgo } from "./orchestration";
import {
  insertDailyLogSchema,
  insertUserTargetsSchema,
  insertInterventionSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User Targets routes
  app.get('/api/targets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const targets = await storage.getUserTargets(userId);
      
      if (!targets) {
        // Create default targets if none exist
        const newTargets = await storage.createUserTargets({
          userId,
          proteinTarget: 100,
          gutTarget: 5,
          sunTarget: 5,
          exerciseTarget: 5,
        });
        return res.json(newTargets);
      }
      
      res.json(targets);
    } catch (error) {
      console.error("Error fetching targets:", error);
      res.status(500).json({ message: "Failed to fetch targets" });
    }
  });

  app.put('/api/targets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let validated: any;
      try {
        validated = require('./validation').validateUserTargetsPayload(req.body);
      } catch (err: any) {
        return res.status(400).json({ message: err.message });
      }

      const targets = await storage.updateUserTargets(userId, validated);
      res.json(targets);
    } catch (error) {
      console.error("Error updating targets:", error);
      res.status(500).json({ message: "Failed to update targets" });
    }
  });

  // Onboarding routes (backend-first)
  app.post('/api/onboarding/start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Optional initial targets in body
      let initialTargets: any = {};
      if (req.body && Object.keys(req.body).length > 0) {
        try {
          initialTargets = require('./validation').validateUserTargetsPayload(req.body);
        } catch (err: any) {
          return res.status(400).json({ message: err.message });
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
      console.error('Error starting onboarding:', error);
      res.status(500).json({ message: error.message || 'Failed to start onboarding' });
    }
  });

  app.get('/api/onboarding/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const targets = await storage.getUserTargets(userId);
      const today = new Date().toISOString().split('T')[0];
      const startDate = getDateDaysAgo(today, 7);
      const logs = await storage.getDailyLogs(userId, startDate, today);

      const status = {
        hasTargets: !!targets,
        isBaselineComplete: targets?.isBaselineComplete || false,
        onboardingComplete: targets?.onboardingComplete || false,
        daysLogged: logs.length,
        daysRemaining: Math.max(0, 7 - logs.length),
      };

      res.json(status);
    } catch (error: any) {
      console.error('Error fetching onboarding status:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch onboarding status' });
    }
  });

  // Daily Logs routes
  app.get('/api/logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.query;
      
      const logs = await storage.getDailyLogs(
        userId,
        startDate as string,
        endDate as string
      );
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.get('/api/logs/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date } = req.params;
      
      const log = await storage.getDailyLog(userId, date);
      
      if (!log) {
        return res.status(404).json({ message: "Log not found" });
      }
      
      res.json(log);
    } catch (error) {
      console.error("Error fetching log:", error);
      res.status(500).json({ message: "Failed to fetch log" });
    }
  });

  app.post('/api/logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate request body (without flags - they'll be computed)
      let validated: any;
      try {
        validated = require('./validation').validateDailyLogPayload({ ...req.body, userId });
      } catch (err: any) {
        return res.status(400).json({ message: err.message });
      }

      // Process the log with orchestration engine
      const processedLog = await processLog(userId, validated);
      const log = await storage.createDailyLog(processedLog);

      // Evaluate clusters and create intervention if needed (do not block response)
      createInterventionIfNeeded(userId, log.date).catch((err) => {
        console.error('Post-persist orchestration failed:', err);
      });

      res.status(201).json(log);
    } catch (error: any) {
      console.error('Error creating log:', error);
      res.status(500).json({ message: error.message || "Failed to create log" });
    }
  });

  app.put('/api/logs/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date } = req.params;
      
      const existingLog = await storage.getDailyLog(userId, date);
      
      if (!existingLog) {
        return res.status(404).json({ message: "Log not found" });
      }
      
      // Validate request body (without flags)
      let validatedPartial: any;
      try {
        validatedPartial = require('./validation').validateDailyLogPayload({ ...existingLog, ...req.body });
      } catch (err: any) {
        return res.status(400).json({ message: err.message });
      }

      // Process the updated log with orchestration engine
      const processedLog = await processLog(userId, {
        ...existingLog,
        ...validatedPartial,
      });

      const log = await storage.updateDailyLog(existingLog.id, processedLog);

      // Re-evaluate clusters after update (do not block response)
      createInterventionIfNeeded(userId, log.date).catch((err) => {
        console.error('Post-persist orchestration failed (update):', err);
      });

      res.json(log);
    } catch (error: any) {
      console.error("Error updating log:", error);
      res.status(500).json({ message: error.message || "Failed to update log" });
    }
  });

  app.delete('/api/logs/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date } = req.params;
      
      const log = await storage.getDailyLog(userId, date);
      
      if (!log) {
        return res.status(404).json({ message: "Log not found" });
      }
      
      await storage.deleteDailyLog(log.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting log:", error);
      res.status(500).json({ message: "Failed to delete log" });
    }
  });

  // Interventions routes
  app.get('/api/interventions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const interventions = await storage.getInterventions(userId);
      res.json(interventions);
    } catch (error) {
      console.error("Error fetching interventions:", error);
      res.status(500).json({ message: "Failed to fetch interventions" });
    }
  });

  app.get('/api/interventions/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const intervention = await storage.getActiveIntervention(userId);
      res.json(intervention || null);
    } catch (error) {
      console.error("Error fetching active intervention:", error);
      res.status(500).json({ message: "Failed to fetch active intervention" });
    }
  });

  app.post('/api/interventions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let validated: any;
      try {
        validated = require('./validation').validateInterventionPayload({ ...req.body, userId });
      } catch (err: any) {
        return res.status(400).json({ message: err.message });
      }

      // Dedupe protection: prevent duplicate hypothesis text and overlapping active interventions
      const all = await storage.getInterventions(userId);
      const newStart = new Date(String(validated.startDate));
      const newEnd = new Date(String(validated.endDate));
      const normalizedHypothesis = String(validated.hypothesisText || '').trim().toLowerCase();

      for (const ex of all) {
        const exHyp = String(ex.hypothesisText || '').trim().toLowerCase();
        if (exHyp && exHyp === normalizedHypothesis) {
          return res.status(400).json({ message: 'An intervention with the same hypothesis already exists' });
        }

        // Check overlapping with any active (non-completed) intervention
        const exStart = new Date(String(ex.startDate));
        const exEnd = new Date(String(ex.endDate));
        const overlaps = !(newEnd < exStart || newStart > exEnd);
        if (overlaps && !ex.result) {
          return res.status(400).json({ message: 'An overlapping active intervention already exists' });
        }
      }

      const intervention = await storage.createIntervention(validated);
      res.status(201).json(intervention);
    } catch (error) {
      console.error("Error creating intervention:", error);
      res.status(500).json({ message: "Failed to create intervention" });
    }
  });

  app.put('/api/interventions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
        validatedFull = require('./validation').validateInterventionPayload({ ...intervention, ...req.body });
      } catch (err: any) {
        return res.status(400).json({ message: err.message });
      }

      const updated = await storage.updateIntervention(id, validatedFull);
      res.json(updated);
    } catch (error) {
      console.error("Error updating intervention:", error);
      res.status(500).json({ message: "Failed to update intervention" });
    }
  });

  // Complete / Check-in for an intervention after its scheduled endDate
  app.post('/api/interventions/:id/checkin', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      console.error('Error completing intervention:', error);
      res.status(500).json({ message: error.message || 'Failed to complete intervention' });
    }
  });

  return httpServer;
}
