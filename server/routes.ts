import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processLog } from "./orchestration";
import {
  insertDailyLogSchema,
  insertUserTargetsSchema,
  insertInterventionSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const validation = insertUserTargetsSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).toString() 
        });
      }
      
      const targets = await storage.updateUserTargets(userId, validation.data);
      res.json(targets);
    } catch (error) {
      console.error("Error updating targets:", error);
      res.status(500).json({ message: "Failed to update targets" });
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
      const validation = insertDailyLogSchema.omit({
        sleepFlag: true,
        rhrFlag: true,
        hrvFlag: true,
        proteinFlag: true,
        gutFlag: true,
        sunFlag: true,
        exerciseFlag: true,
        symptomFlag: true,
      }).safeParse({ ...req.body, userId });
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).toString() 
        });
      }
      
      // Process the log with orchestration engine
      const processedLog = await processLog(userId, validation.data);
      const log = await storage.createDailyLog(processedLog);
      
      res.status(201).json(log);
    } catch (error: any) {
      console.error("Error creating log:", error);
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
      const validation = insertDailyLogSchema.partial().omit({
        sleepFlag: true,
        rhrFlag: true,
        hrvFlag: true,
        proteinFlag: true,
        gutFlag: true,
        sunFlag: true,
        exerciseFlag: true,
        symptomFlag: true,
      }).safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).toString() 
        });
      }
      
      // Process the updated log with orchestration engine
      const processedLog = await processLog(userId, {
        ...existingLog,
        ...validation.data,
      });
      
      const log = await storage.updateDailyLog(existingLog.id, processedLog);
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
      const validation = insertInterventionSchema.safeParse({ 
        ...req.body, 
        userId 
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).toString() 
        });
      }
      
      const intervention = await storage.createIntervention(validation.data);
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
      
      const validation = insertInterventionSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).toString() 
        });
      }
      
      const updated = await storage.updateIntervention(id, validation.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating intervention:", error);
      res.status(500).json({ message: "Failed to update intervention" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
