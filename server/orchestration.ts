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
      onboardingComplete: true,
    });
    
    // Update local targets reference
    targets.sleepBaseline = sleepBaseline;
    targets.rhrBaseline = rhrBaseline;
    targets.hrvBaseline = hrvBaseline;
    targets.isBaselineComplete = true;
    targets.onboardingComplete = true;
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
 * After a log has been persisted, evaluate recent logs for clusters and
 * create an Intervention if Mode 1 (negative) is detected and no active
 * intervention lock exists for the user.
 */
export async function createInterventionIfNeeded(userId: string, date: string) {
  // Respect existing intervention lock
  const targets = await storage.getUserTargets(userId);
  if (!targets) return;
  if (targets.activeInterventionId) return; // lock present, do not create

  // Detect clusters across last 3 days
  const result = await detectClusters(userId, 3);

  if (result.mode === 'negative' && result.hypothesis) {
    // Create intervention for 7 days starting on `date`
    try {
      const start = new Date(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      // Dedupe protection: check for duplicate hypothesis or overlapping active interventions
      const existing = await storage.getInterventions(userId);
      const normalizedHyp = String(result.hypothesis).trim().toLowerCase();
      let skipCreate = false;
      for (const ex of existing) {
        const exHyp = String(ex.hypothesisText || '').trim().toLowerCase();
        if (exHyp && exHyp === normalizedHyp) {
          skipCreate = true;
          break;
        }
        const exStart = new Date(String(ex.startDate));
        const exEnd = new Date(String(ex.endDate));
        const overlaps = !(end < exStart || start > exEnd);
        if (overlaps && !ex.result) {
          skipCreate = true;
          break;
        }
      }

      if (skipCreate) {
        return; // do not create duplicate/overlapping intervention
      }

      const intervention = await storage.createIntervention({
        userId,
        hypothesisText: result.hypothesis,
        startDate: start,
        endDate: end,
      });

      // Update user targets to set activeInterventionId lock
      await storage.updateUserTargets(userId, {
        activeInterventionId: intervention.id,
      });
    } catch (err) {
      console.error('Failed to create intervention:', err);
    }
  }
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
  if (baseline === null || baseline === undefined || baseline === 0) {
    return "YELLOW"; // No baseline or invalid baseline (0), conservative flagging
  }

  // Use deviation thresholds per SoT: 15% => RED, 8% => YELLOW
  // Direction matters: for RHR lower is better; for sleep/hrv higher is better.
  const deviationThresholdRed = 0.15;
  const deviationThresholdYellow = 0.08;
  const EPS = 1e-9;

  if (type === 'rhr') {
    // RHR: lower is better. Only deviations above baseline (higher RHR) are bad.
    if (value <= baseline) return "GREEN";
    const deviation = (value - baseline) / baseline; // positive when worse
    if (deviation + EPS >= deviationThresholdRed) return "RED";
    if (deviation + EPS >= deviationThresholdYellow) return "YELLOW";
    return "GREEN";
  } else {
    // Sleep & HRV: higher is better. Only deviations below baseline are bad.
    if (value >= baseline) return "GREEN";
    const deviation = (baseline - value) / baseline; // positive when worse
    if (deviation + EPS >= deviationThresholdRed) return "RED";
    if (deviation + EPS >= deviationThresholdYellow) return "YELLOW";
    return "GREEN";
  }
}

/**
 * Flag manual inputs against targets
 * - GREEN: Met or exceeded target
 * - YELLOW: 80-99% of target
 * - RED: <80% of target
 */
function flagManual(value: number, target: number): Flag {
  if (!target || target === 0) {
    return "YELLOW"; // No meaningful target, conservative
  }

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
  // Fetch up to the last 7 days (we need 3-day, 5-day and 7-day windows)
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = getDateDaysAgo(endDate, 7);
  const logsRaw = await storage.getDailyLogs(userId, startDate, endDate);

  // Ensure chronological order (oldest -> newest)
  const logs = logsRaw.slice().sort((a: any, b: any) => a.date.localeCompare(b.date));

  if (logs.length === 0) {
    return { mode: null, clusters: [], hypothesis: null };
  }

  const metrics = ['sleep', 'rhr', 'hrv', 'protein', 'gut', 'sun', 'exercise'];

  // ----- Mode 1 (Negative Cluster Alert) -----
  // Required: For the most recent 3 days: symptomScore >=4 AND >=2 non-symptom RED/YELLOW flags
  if (logs.length >= 3) {
    const last3 = logs.slice(-3);

    const mode1AllMatch = last3.every((log: any) => {
      const hasHighSymptoms = (log.symptomScore ?? 0) >= 4;
      const redYellowCount = metrics.filter((m) => {
        const flagName = `${m}Flag`;
        return (log as any)[flagName] === 'RED' || (log as any)[flagName] === 'YELLOW';
      }).length;
      return hasHighSymptoms && redYellowCount >= 2;
    });

    if (mode1AllMatch) {
      const clusters = findNegativeClusters(last3);
      const hypothesis = generateNegativeHypothesis(clusters);
      return { mode: 'negative', clusters, hypothesis };
    }
  }

  // ----- Mode 2 (Positive Consistency - 7-day check) -----
  // Required: 7-day window: >=80% of non-symptom flags are GREEN AND symptom avg <= 2
  if (logs.length >= 7) {
    const last7 = logs.slice(-7);
    const totalFlags = last7.length * metrics.length;
    let greenCount = 0;
    let symptomSum = 0;

    for (const log of last7) {
      symptomSum += (log.symptomScore ?? 0);
      for (const m of metrics) {
        if ((log as any)[`${m}Flag`] === 'GREEN') greenCount++;
      }
    }

    const greenRatio = greenCount / totalFlags;
    const symptomAvg = symptomSum / last7.length;

    if (greenRatio >= 0.8 && symptomAvg <= 2) {
      const clusters = findPositiveClusters(last7);
      const hypothesis = generatePositiveHypothesis(clusters);
      return { mode: 'positive', clusters, hypothesis };
    }
  }

  // ----- Mode 3 (Stagnation) -----
  // Required: 5 consecutive days where 70% of non-symptom metric flags maintained the exact same state
  if (logs.length >= 5) {
    // Sliding windows of length 5 within available logs (prefer most recent windows)
    for (let i = Math.max(0, logs.length - 5); i >= 0; i--) {
      const window = logs.slice(i, i + 5);
      if (window.length < 5) continue;

      // Count metrics that remained identical across the 5-day window
      let identicalMetrics = 0;
      for (const m of metrics) {
        const first = (window[0] as any)[`${m}Flag`];
        const allSame = window.every((d: any) => d[`${m}Flag`] === first);
        if (allSame) identicalMetrics++;
      }

      const identicalFlags = identicalMetrics * window.length; // each identical metric contributes 5 identical flags
      const totalFlags = metrics.length * window.length;
      const identicalRatio = identicalFlags / totalFlags;

      if (identicalRatio >= 0.7) {
        const hypothesis = "Your metrics have been stagnant. Consider adjusting your approach.";
        return { mode: 'stagnation', clusters: [], hypothesis };
      }
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
export function getDateDaysAgo(fromDate: string, days: number): string {
  const date = new Date(fromDate);
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}
