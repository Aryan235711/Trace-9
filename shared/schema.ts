import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  real,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (Required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (Required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  plan: varchar("plan").notNull().default('free'),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User Targets & Baselines (Trace-9 specific)
export const userTargets = pgTable("user_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Manual Targets
  proteinTarget: integer("protein_target").notNull().default(100),
  gutTarget: integer("gut_target").notNull().default(5),
  sunTarget: integer("sun_target").notNull().default(5), // 1, 3, or 5
  exerciseTarget: integer("exercise_target").notNull().default(5), // 1, 2, 4, or 5
  
  // Wearable Baselines (7-day averages)
  sleepBaseline: real("sleep_baseline"),
  rhrBaseline: real("rhr_baseline"),
  hrvBaseline: real("hrv_baseline"),
  
  // State tracking
  isBaselineComplete: boolean("is_baseline_complete").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  activeInterventionId: varchar("active_intervention_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserTargetsSchema = createInsertSchema(userTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserTargets = z.infer<typeof insertUserTargetsSchema>;
export type UserTargets = typeof userTargets.$inferSelect;

// Daily Logs (Trace-9 specific)
export const dailyLogs = pgTable("daily_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: varchar("date").notNull(), // YYYY-MM-DD format
  
  // Raw wearable values
  sleep: real("sleep").notNull(),
  rhr: real("rhr").notNull(),
  hrv: real("hrv").notNull(),
  
  // Raw manual values
  protein: integer("protein").notNull(),
  gut: integer("gut").notNull(),
  sun: integer("sun").notNull(),
  exercise: integer("exercise").notNull(),
  
  // Symptom data
  symptomScore: integer("symptom_score").notNull(),
  symptomName: varchar("symptom_name"),
  
  // Processed states (RED/YELLOW/GREEN flags)
  sleepFlag: varchar("sleep_flag").notNull(),
  rhrFlag: varchar("rhr_flag").notNull(),
  hrvFlag: varchar("hrv_flag").notNull(),
  proteinFlag: varchar("protein_flag").notNull(),
  gutFlag: varchar("gut_flag").notNull(),
  sunFlag: varchar("sun_flag").notNull(),
  exerciseFlag: varchar("exercise_flag").notNull(),
  symptomFlag: varchar("symptom_flag").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;

// Interventions (Trace-9 specific)
export const interventions = pgTable("interventions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  hypothesisText: varchar("hypothesis_text").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Result after 7 days
  result: varchar("result"), // 'Yes' | 'No' | 'Partial'
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInterventionSchema = createInsertSchema(interventions).omit({
  id: true,
  createdAt: true,
});

export type InsertIntervention = z.infer<typeof insertInterventionSchema>;
export type Intervention = typeof interventions.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  targets: one(userTargets, {
    fields: [users.id],
    references: [userTargets.userId],
  }),
  dailyLogs: many(dailyLogs),
  interventions: many(interventions),
}));

export const userTargetsRelations = relations(userTargets, ({ one }) => ({
  user: one(users, {
    fields: [userTargets.userId],
    references: [users.id],
  }),
}));

export const dailyLogsRelations = relations(dailyLogs, ({ one }) => ({
  user: one(users, {
    fields: [dailyLogs.userId],
    references: [users.id],
  }),
}));

export const interventionsRelations = relations(interventions, ({ one }) => ({
  user: one(users, {
    fields: [interventions.userId],
    references: [users.id],
  }),
}));
