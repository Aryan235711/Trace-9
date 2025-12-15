import {
  users,
  userTargets,
  dailyLogs,
  interventions,
  type User,
  type UpsertUser,
  type UserTargets,
  type InsertUserTargets,
  type DailyLog,
  type InsertDailyLog,
  type Intervention,
  type InsertIntervention,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // User Targets operations
  getUserTargets(userId: string): Promise<UserTargets | undefined>;
  createUserTargets(targets: InsertUserTargets): Promise<UserTargets>;
  updateUserTargets(userId: string, targets: Partial<InsertUserTargets>): Promise<UserTargets>;
  
  // Daily Logs operations
  getDailyLog(userId: string, date: string): Promise<DailyLog | undefined>;
  getDailyLogs(userId: string, startDate?: string, endDate?: string): Promise<DailyLog[]>;
  createDailyLog(log: InsertDailyLog): Promise<DailyLog>;
  updateDailyLog(id: string, log: Partial<InsertDailyLog>): Promise<DailyLog>;
  deleteDailyLog(id: string): Promise<void>;
  
  // Interventions operations
  getIntervention(id: string): Promise<Intervention | undefined>;
  getInterventions(userId: string): Promise<Intervention[]>;
  getActiveIntervention(userId: string): Promise<Intervention | undefined>;
  createIntervention(intervention: InsertIntervention): Promise<Intervention>;
  updateIntervention(id: string, intervention: Partial<InsertIntervention>): Promise<Intervention>;
}

export class DatabaseStorage implements IStorage {
  private async timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (process.env.PROFILING !== '1') {
      return fn();
    }
    const start = Date.now();
    try {
      const res = await fn();
      const duration = Date.now() - start;
      console.log(`[db] ${label} took ${duration}ms`);
      return res;
    } catch (err) {
      const duration = Date.now() - start;
      console.log(`[db] ${label} failed after ${duration}ms`);
      throw err;
    }
  }
  // User operations (Required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.timed('getUser', async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    });
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    return this.timed('upsertUser', async () => {
      const toInsert: UpsertUser = {
        ...userData,
        plan: userData.plan ?? 'free',
      };

      const updates: Partial<UpsertUser> & { updatedAt: Date } = {
        updatedAt: new Date(),
      };

      if (userData.email !== undefined) updates.email = userData.email;
      if (userData.firstName !== undefined) updates.firstName = userData.firstName;
      if (userData.lastName !== undefined) updates.lastName = userData.lastName;
      if (userData.profileImageUrl !== undefined) updates.profileImageUrl = userData.profileImageUrl;
      if (userData.plan !== undefined) updates.plan = userData.plan;

      const [user] = await db
        .insert(users)
        .values(toInsert)
        .onConflictDoUpdate({
          target: users.id,
          set: updates,
        })
        .returning();
      return user;
    });
  }

  // User Targets operations
  async getUserTargets(userId: string): Promise<UserTargets | undefined> {
    return this.timed('getUserTargets', async () => {
      const [targets] = await db
        .select()
        .from(userTargets)
        .where(eq(userTargets.userId, userId));
      return targets;
    });
  }

  async createUserTargets(targetsData: InsertUserTargets): Promise<UserTargets> {
    return this.timed('createUserTargets', async () => {
      const [targets] = await db
        .insert(userTargets)
        .values(targetsData)
        .returning();
      return targets;
    });
  }

  async updateUserTargets(userId: string, targetsData: Partial<InsertUserTargets>): Promise<UserTargets> {
    return this.timed('updateUserTargets', async () => {
      const [targets] = await db
        .update(userTargets)
        .set({
          ...targetsData,
          updatedAt: new Date(),
        })
        .where(eq(userTargets.userId, userId))
        .returning();
      return targets;
    });
  }

  // Daily Logs operations
  async getDailyLog(userId: string, date: string): Promise<DailyLog | undefined> {
    return this.timed('getDailyLog', async () => {
      const [log] = await db
        .select()
        .from(dailyLogs)
        .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));
      return log;
    });
  }

  async getDailyLogs(userId: string, startDate?: string, endDate?: string): Promise<DailyLog[]> {
    return this.timed('getDailyLogs', async () => {
      const whereClause = startDate && endDate
        ? and(
            eq(dailyLogs.userId, userId),
            gte(dailyLogs.date, startDate),
            lte(dailyLogs.date, endDate)
          )
        : eq(dailyLogs.userId, userId);

      const logs = await db
        .select()
        .from(dailyLogs)
        .where(whereClause)
        .orderBy(desc(dailyLogs.date));
      return logs;
    });
  }

  async createDailyLog(logData: InsertDailyLog): Promise<DailyLog> {
    return this.timed('createDailyLog', async () => {
      const [log] = await db
        .insert(dailyLogs)
        .values(logData)
        .returning();
      return log;
    });
  }

  async updateDailyLog(id: string, logData: Partial<InsertDailyLog>): Promise<DailyLog> {
    return this.timed('updateDailyLog', async () => {
      const [log] = await db
        .update(dailyLogs)
        .set(logData)
        .where(eq(dailyLogs.id, id))
        .returning();
      return log;
    });
  }

  async deleteDailyLog(id: string): Promise<void> {
    return this.timed('deleteDailyLog', async () => {
      await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
    });
  }

  // Interventions operations
  async getIntervention(id: string): Promise<Intervention | undefined> {
    return this.timed('getIntervention', async () => {
      const [intervention] = await db
        .select()
        .from(interventions)
        .where(eq(interventions.id, id));
      return intervention;
    });
  }

  async getInterventions(userId: string): Promise<Intervention[]> {
    return this.timed('getInterventions', async () => {
      const results = await db
        .select()
        .from(interventions)
        .where(eq(interventions.userId, userId))
        .orderBy(desc(interventions.createdAt));
      return results;
    });
  }

  async getActiveIntervention(userId: string): Promise<Intervention | undefined> {
    return this.timed('getActiveIntervention', async () => {
      const [intervention] = await db
        .select()
        .from(interventions)
        .where(
          and(
            eq(interventions.userId, userId),
            eq(interventions.result, null as any)
          )
        )
        .orderBy(desc(interventions.createdAt));
      return intervention;
    });
  }

  async createIntervention(interventionData: InsertIntervention): Promise<Intervention> {
    return this.timed('createIntervention', async () => {
      const [intervention] = await db
        .insert(interventions)
        .values(interventionData)
        .returning();
      return intervention;
    });
  }

  async updateIntervention(id: string, interventionData: Partial<InsertIntervention>): Promise<Intervention> {
    return this.timed('updateIntervention', async () => {
      const [intervention] = await db
        .update(interventions)
        .set(interventionData)
        .where(eq(interventions.id, id))
        .returning();
      return intervention;
    });
  }
}

export const storage = new DatabaseStorage();
