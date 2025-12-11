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
  // User operations (Required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // User Targets operations
  async getUserTargets(userId: string): Promise<UserTargets | undefined> {
    const [targets] = await db
      .select()
      .from(userTargets)
      .where(eq(userTargets.userId, userId));
    return targets;
  }

  async createUserTargets(targetsData: InsertUserTargets): Promise<UserTargets> {
    const [targets] = await db
      .insert(userTargets)
      .values(targetsData)
      .returning();
    return targets;
  }

  async updateUserTargets(userId: string, targetsData: Partial<InsertUserTargets>): Promise<UserTargets> {
    const [targets] = await db
      .update(userTargets)
      .set({
        ...targetsData,
        updatedAt: new Date(),
      })
      .where(eq(userTargets.userId, userId))
      .returning();
    return targets;
  }

  // Daily Logs operations
  async getDailyLog(userId: string, date: string): Promise<DailyLog | undefined> {
    const [log] = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));
    return log;
  }

  async getDailyLogs(userId: string, startDate?: string, endDate?: string): Promise<DailyLog[]> {
    let query = db.select().from(dailyLogs).where(eq(dailyLogs.userId, userId));
    
    if (startDate && endDate) {
      query = query.where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, startDate),
          lte(dailyLogs.date, endDate)
        )
      );
    }
    
    const logs = await query.orderBy(desc(dailyLogs.date));
    return logs;
  }

  async createDailyLog(logData: InsertDailyLog): Promise<DailyLog> {
    const [log] = await db
      .insert(dailyLogs)
      .values(logData)
      .returning();
    return log;
  }

  async updateDailyLog(id: string, logData: Partial<InsertDailyLog>): Promise<DailyLog> {
    const [log] = await db
      .update(dailyLogs)
      .set(logData)
      .where(eq(dailyLogs.id, id))
      .returning();
    return log;
  }

  async deleteDailyLog(id: string): Promise<void> {
    await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
  }

  // Interventions operations
  async getIntervention(id: string): Promise<Intervention | undefined> {
    const [intervention] = await db
      .select()
      .from(interventions)
      .where(eq(interventions.id, id));
    return intervention;
  }

  async getInterventions(userId: string): Promise<Intervention[]> {
    const results = await db
      .select()
      .from(interventions)
      .where(eq(interventions.userId, userId))
      .orderBy(desc(interventions.createdAt));
    return results;
  }

  async getActiveIntervention(userId: string): Promise<Intervention | undefined> {
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
  }

  async createIntervention(interventionData: InsertIntervention): Promise<Intervention> {
    const [intervention] = await db
      .insert(interventions)
      .values(interventionData)
      .returning();
    return intervention;
  }

  async updateIntervention(id: string, interventionData: Partial<InsertIntervention>): Promise<Intervention> {
    const [intervention] = await db
      .update(interventions)
      .set(interventionData)
      .where(eq(interventions.id, id))
      .returning();
    return intervention;
  }
}

export const storage = new DatabaseStorage();
