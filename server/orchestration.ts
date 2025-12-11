import { storage } from "./storage";
import type { InsertDailyLog } from "@shared/schema";

// Flag types
type Flag = "RED" | "YELLOW" | "GREEN";

// Orchestration engine for Trace-9
// Implements: Universal Flagging, 7-Day Baseline Calculation, 3-Day Trend Rule, and Clustering

/**
 * Process a daily log entry through the orchestration pipeline
 * 1. Calculate 7-day baselines if needed
 * 2. Apply universal flagging logic
 * 3. Check for clustering patterns
 * 4. Generate hypotheses if needed
 */
export async function processLog(
  userId: string,
  logData: Omit<InsertDailyLog, 'sleepFlag' | 'rhrFlag' | 'hrvFlag' | 'proteinFlag' | 'gutFlag' | 'sunFlag' | 'exerciseFlag' | 'symptomFlag'>
): Promise<InsertDailyLog> {
  // Get user targets
  const targets = await storage.getUserTargets(userId);
  
  if (!targets) {
    throw new Error("User targets not found. Please complete onboarding first.");
  }
  
  // Get last 7 days of logs (for baseline calculation)
  const endDate = logData.date;
  const startDate = getDateDaysAgo(endDate, 7);
  const recentLogs = await storage.getDailyLogs(userId, startDate, endDate);
  
  // Calculate 7-day baselines if we have enough data and haven't already
  if (!targets.isBaselineComplete && recentLogs.length >= 7) {
    const sleepBaseline = calculateAverage(recentLogs.map(l => l.sleep));
    const rhrBaseline = calculateAverage(recentLogs.map(l => l.rhr));
    const hrvBaseline = calculateAverage(recentLogs.map(l => l.hrv));
    
    await storage.updateUserTargets(userId, {
      sleepBaseline,
      rhrBaseline,
      hrvBaseline,
      isBaselineComplete: true,
    });
    
    // Update local targets reference
    targets.sleepBaseline = sleepBaseline;
    targets.rhrBaseline = rhrBaseline;
    targets.hrvBaseline = hrvBaseline;
    targets.isBaselineComplete = true;
  }
  
  // Apply universal flagging
  const flags = applyUniversalFlagging(logData, targets);
  
  // Return processed log with flags
  return {
    ...logData,
    ...flags,
  };
}

/**
 * Apply Universal Flagging to all 8 metrics
 * Rules:
 * - Wearables (Sleep, RHR, HRV): Compare against 7-day baseline
 * - Manual (Protein, Gut, Sun, Exercise): Compare against targets
 * - Symptom: Always flag based on severity (0=GREEN, 1-4=YELLOW, 5+=RED)
 */
function applyUniversalFlagging(
  logData: any,
  targets: any
): {
  sleepFlag: Flag;
  rhrFlag: Flag;
  hrvFlag: Flag;
  proteinFlag: Flag;
  gutFlag: Flag;
  sunFlag: Flag;
  exerciseFlag: Flag;
  symptomFlag: Flag;
} {
  // Wearable flagging (based on baselines)
  const sleepFlag = flagWearable(
    logData.sleep,
    targets.sleepBaseline,
    'sleep'
  );
  const rhrFlag = flagWearable(
    logData.rhr,
    targets.rhrBaseline,
    'rhr'
  );
  const hrvFlag = flagWearable(
    logData.hrv,
    targets.hrvBaseline,
    'hrv'
  );
  
  // Manual input flagging (based on targets)
  const proteinFlag = flagManual(logData.protein, targets.proteinTarget);
  const gutFlag = flagManual(logData.gut, targets.gutTarget);
  const sunFlag = flagManual(logData.sun, targets.sunTarget);
  const exerciseFlag = flagManual(logData.exercise, targets.exerciseTarget);
  
  // Symptom flagging (severity-based)
  const symptomFlag = flagSymptom(logData.symptomScore);
  
  return {
    sleepFlag,
    rhrFlag,
    hrvFlag,
    proteinFlag,
    gutFlag,
    sunFlag,
    exerciseFlag,
    symptomFlag,
  };
}

/**
 * Flag wearable metrics against 7-day baseline
 * - Sleep & HRV: Higher is better (GREEN: >=baseline, YELLOW: 90-99%, RED: <90%)
 * - RHR: Lower is better (GREEN: <=baseline, YELLOW: 101-110%, RED: >110%)
 */
function flagWearable(value: number, baseline: number | null, type: 'sleep' | 'rhr' | 'hrv'): Flag {
  if (baseline === null || baseline === undefined) {
    return "YELLOW"; // No baseline yet, conservative flagging
  }
  
  const percentage = (value / baseline) * 100;
  
  if (type === 'rhr') {
    // RHR: Lower is better
    if (percentage <= 100) return "GREEN";
    if (percentage <= 110) return "YELLOW";
    return "RED";
  } else {
    // Sleep & HRV: Higher is better
    if (percentage >= 100) return "GREEN";
    if (percentage >= 90) return "YELLOW";
    return "RED";
  }
}

/**
 * Flag manual inputs against targets
 * - GREEN: Met or exceeded target
 * - YELLOW: 80-99% of target
 * - RED: <80% of target
 */
function flagManual(value: number, target: number): Flag {
  const percentage = (value / target) * 100;
  
  if (percentage >= 100) return "GREEN";
  if (percentage >= 80) return "YELLOW";
  return "RED";
}

/**
 * Flag symptom severity
 * - 0: GREEN (no symptoms)
 * - 1-4: YELLOW (mild to moderate)
 * - 5+: RED (severe)
 */
function flagSymptom(severity: number): Flag {
  if (severity === 0) return "GREEN";
  if (severity <= 4) return "YELLOW";
  return "RED";
}

/**
 * Detect clustering patterns across last N days
 * Returns clusters of RED/YELLOW flags that appear together
 */
export async function detectClusters(
  userId: string,
  days: number = 3
): Promise<{
  mode: 'negative' | 'positive' | 'stagnation' | null;
  clusters: string[][];
  hypothesis: string | null;
}> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = getDateDaysAgo(endDate, days);
  const logs = await storage.getDailyLogs(userId, startDate, endDate);
  
  if (logs.length < days) {
    return { mode: null, clusters: [], hypothesis: null };
  }
  
  // Check for 3-Day Trend Rule (RED symptoms for 3 consecutive days)
  const symptomReds = logs.filter(l => l.symptomFlag === 'RED').length;
  
  if (symptomReds >= 3) {
    // Negative Cluster Alert
    const clusters = findNegativeClusters(logs);
    const hypothesis = generateNegativeHypothesis(clusters);
    return { mode: 'negative', clusters, hypothesis };
  }
  
  // Check for Positive Consistency (GREEN symptoms for 3+ days)
  const symptomGreens = logs.filter(l => l.symptomFlag === 'GREEN').length;
  
  if (symptomGreens >= 3) {
    // Positive Consistency
    const clusters = findPositiveClusters(logs);
    const hypothesis = generatePositiveHypothesis(clusters);
    return { mode: 'positive', clusters, hypothesis };
  }
  
  // Check for Stagnation (YELLOW for 5+ days, no improvement)
  if (logs.length >= 5) {
    const stagnant = checkStagnation(logs);
    if (stagnant) {
      const hypothesis = "Your metrics have been stagnant. Consider adjusting your approach.";
      return { mode: 'stagnation', clusters: [], hypothesis };
    }
  }
  
  return { mode: null, clusters: [], hypothesis: null };
}

/**
 * Find metrics that are consistently RED when symptoms are RED
 */
function findNegativeClusters(logs: any[]): string[][] {
  const metrics = ['sleep', 'rhr', 'hrv', 'protein', 'gut', 'sun', 'exercise'];
  const clusters: string[][] = [];
  
  // Find metrics with RED flags in majority of symptom-RED days
  const symptomRedDays = logs.filter(l => l.symptomFlag === 'RED');
  
  for (const metric of metrics) {
    const redCount = symptomRedDays.filter(
      l => l[`${metric}Flag`] === 'RED'
    ).length;
    
    if (redCount >= 2) { // At least 2 days of RED correlation
      clusters.push([metric]);
    }
  }
  
  return clusters;
}

/**
 * Find metrics that are consistently GREEN when symptoms are GREEN
 */
function findPositiveClusters(logs: any[]): string[][] {
  const metrics = ['sleep', 'rhr', 'hrv', 'protein', 'gut', 'sun', 'exercise'];
  const clusters: string[][] = [];
  
  const symptomGreenDays = logs.filter(l => l.symptomFlag === 'GREEN');
  
  for (const metric of metrics) {
    const greenCount = symptomGreenDays.filter(
      l => l[`${metric}Flag`] === 'GREEN'
    ).length;
    
    if (greenCount >= 2) {
      clusters.push([metric]);
    }
  }
  
  return clusters;
}

/**
 * Check if metrics are stagnant (no progress)
 */
function checkStagnation(logs: any[]): boolean {
  const metrics = ['sleep', 'rhr', 'hrv', 'protein', 'gut', 'sun', 'exercise'];
  
  // Count YELLOW flags across all metrics
  let yellowCount = 0;
  
  for (const log of logs) {
    for (const metric of metrics) {
      if (log[`${metric}Flag`] === 'YELLOW') {
        yellowCount++;
      }
    }
  }
  
  // If more than 50% of flags are YELLOW, consider it stagnant
  const totalFlags = logs.length * metrics.length;
  return (yellowCount / totalFlags) > 0.5;
}

/**
 * Generate hypothesis for negative clusters
 */
function generateNegativeHypothesis(clusters: string[][]): string | null {
  if (clusters.length === 0) return null;
  
  const metrics = clusters.map(c => formatMetricName(c[0])).join(", ");
  return `Your symptoms correlate with low ${metrics}. Try improving these areas.`;
}

/**
 * Generate hypothesis for positive clusters
 */
function generatePositiveHypothesis(clusters: string[][]): string | null {
  if (clusters.length === 0) return null;
  
  const metrics = clusters.map(c => formatMetricName(c[0])).join(", ");
  return `Great! Your ${metrics} seem to be helping. Keep it up!`;
}

/**
 * Helper: Format metric name for display
 */
function formatMetricName(metric: string): string {
  const names: Record<string, string> = {
    sleep: "Sleep",
    rhr: "Resting Heart Rate",
    hrv: "Heart Rate Variability",
    protein: "Protein Intake",
    gut: "Gut Health",
    sun: "Sun Exposure",
    exercise: "Exercise",
  };
  return names[metric] || metric;
}

/**
 * Helper: Calculate average of an array
 */
function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10; // Round to 1 decimal
}

/**
 * Helper: Get date N days ago in YYYY-MM-DD format
 */
function getDateDaysAgo(fromDate: string, days: number): string {
  const date = new Date(fromDate);
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}
