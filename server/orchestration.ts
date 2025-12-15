import { storage } from "./storage";
import type { InsertDailyLog } from "@shared/schema";
import { writeDebugArtifact } from "./debugArtifacts";

// Flag types
type Flag = "RED" | "YELLOW" | "GREEN";

const POPULATION_BASELINES = {
  sleep: 7.5,
  rhr: 65,
  hrv: 50,
} as const;

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
  
  // Fetch recent logs including the current day and dedupe by date.
  // This avoids double-counting when processing an update of an existing log.
  const endDate = logData.date;
  const startDate = getDateDaysAgo(endDate, 7);
  const recentLogs = await storage.getDailyLogs(userId, startDate, endDate);
  const byDate = new Map<string, any>();
  for (const l of recentLogs) byDate.set(String((l as any).date), l);
  byDate.set(String(logData.date), logData);
  const uniqueLogs = Array.from(byDate.values()).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

  // Calculate 7-day baselines once we have at least 7 unique days of wearable data.
  // Until baselines exist, wearable flagging uses population averages.
  if (!targets.isBaselineComplete && uniqueLogs.length >= 7) {
    const last7 = uniqueLogs.slice(-7);
    const sleepBaseline = calculateAverage(last7.map(l => l.sleep));
    const rhrBaseline = calculateAverage(last7.map(l => l.rhr));
    const hrvBaseline = calculateAverage(last7.map(l => l.hrv));

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
  writeDebugArtifact('createInterventionIfNeeded.start', userId, { date });
  // Respect existing intervention lock
  const targets = await storage.getUserTargets(userId);
  if (!targets) {
    writeDebugArtifact('createInterventionIfNeeded.noTargets', userId, { date });
    return;
  }
  if (targets.activeInterventionId) {
    writeDebugArtifact('createInterventionIfNeeded.locked', userId, { date, activeInterventionId: targets.activeInterventionId });
    return; // lock present, do not create
  }

  // Detect clusters across last 3 days (use persisted log date)
  const result = await detectClusters(userId, 3, date);
  writeDebugArtifact('createInterventionIfNeeded.detectClusters', userId, { date, result });

  if (result.mode === 'negative' && result.hypothesis) {
    // Create intervention for 7 days starting on `date`
    try {
      const start = new Date(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      // Dedupe protection: check for duplicate hypothesis or overlapping active interventions
      const existing = await storage.getInterventions(userId);
      writeDebugArtifact('createInterventionIfNeeded.existingInterventions', userId, { date, count: existing.length });
      const normalizedHyp = String(result.hypothesis).trim().toLowerCase();
      let skipCreate = false;
      for (const ex of existing) {
        const exHyp = String(ex.hypothesisText || '').trim().toLowerCase();
        if (exHyp && exHyp === normalizedHyp) {
          writeDebugArtifact('createInterventionIfNeeded.skipDuplicate', userId, { date, exId: ex.id });
          skipCreate = true;
          break;
        }
        const exStart = new Date(String(ex.startDate));
        const exEnd = new Date(String(ex.endDate));
        const overlaps = !(end < exStart || start > exEnd);
        if (overlaps && !ex.result) {
          writeDebugArtifact('createInterventionIfNeeded.skipOverlap', userId, { date, exId: ex.id });
          skipCreate = true;
          break;
        }
      }

      if (skipCreate) {
        return; // do not create duplicate/overlapping intervention
      }

      writeDebugArtifact('createInterventionIfNeeded.creating', userId, { date, start: start.toISOString(), end: end.toISOString(), hypothesis: result.hypothesis });
      const intervention = await storage.createIntervention({
        userId,
        hypothesisText: result.hypothesis,
        startDate: start,
        endDate: end,
      });

      writeDebugArtifact('createInterventionIfNeeded.created', userId, { date, interventionId: intervention.id });

      // Update user targets to set activeInterventionId lock
      await storage.updateUserTargets(userId, {
        activeInterventionId: intervention.id,
      });
      writeDebugArtifact('createInterventionIfNeeded.lockSet', userId, { date, interventionId: intervention.id });
    } catch (err) {
      writeDebugArtifact('createInterventionIfNeeded.error', userId, { date, error: String((err as any)?.message || err) });
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
  const sleepBaseline = targets.isBaselineComplete ? targets.sleepBaseline : POPULATION_BASELINES.sleep;
  const rhrBaseline = targets.isBaselineComplete ? targets.rhrBaseline : POPULATION_BASELINES.rhr;
  const hrvBaseline = targets.isBaselineComplete ? targets.hrvBaseline : POPULATION_BASELINES.hrv;

  // Wearable flagging (based on baselines)
  const sleepFlag = flagWearable(
    logData.sleep,
    sleepBaseline,
    'sleep'
  );
  const rhrFlag = flagWearable(
    logData.rhr,
    rhrBaseline,
    'rhr'
  );
  const hrvFlag = flagWearable(
    logData.hrv,
    hrvBaseline,
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
  days: number = 3,
  // Optional end date (YYYY-MM-DD) to evaluate the window relative to a persisted log
  endDateStr?: string
): Promise<{
  mode: 'negative' | 'positive' | 'stagnation' | null;
  clusters: string[][];
  hypothesis: string | null;
}> {
  const targets = await storage.getUserTargets(userId);
  if (!targets) {
    return { mode: null, clusters: [], hypothesis: null };
  }

  // Fetch up to the last 7 days (we need 3-day, 5-day and 7-day windows)
  const endDate = endDateStr || new Date().toISOString().split('T')[0];
  const startDate = getDateDaysAgo(endDate, 7);
  
  const logsRaw = await storage.getDailyLogs(userId, startDate, endDate);

  writeDebugArtifact('detectClusters.fetched', userId, {
    days,
    endDate,
    startDate,
    fetchedCount: logsRaw.length,
  });

  // Ensure chronological order (oldest -> newest) and compute flags from raw values.
  // This makes insights robust even if historical logs were stored with provisional flags.
  const logs = logsRaw
    .slice()
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    .map((l: any) => ({
      ...l,
      ...applyUniversalFlagging(l, targets),
    }));

  writeDebugArtifact('detectClusters.logs', userId, {
    days,
    endDate,
    startDate,
    logsCount: logs.length,
    logs: logs.map((l: any) => ({
      date: l.date,
      symptomScore: l.symptomScore,
      sleepFlag: l.sleepFlag,
      rhrFlag: l.rhrFlag,
      hrvFlag: l.hrvFlag,
      proteinFlag: l.proteinFlag,
      gutFlag: l.gutFlag,
      sunFlag: l.sunFlag,
      exerciseFlag: l.exerciseFlag,
    })),
  });

  if (logs.length === 0) {
    const emptyResult = { mode: null, clusters: [], hypothesis: null };
    writeDebugArtifact('detectClusters.result', userId, { days, endDate, startDate, result: emptyResult });
    return emptyResult;
  }

  const metrics = ['sleep', 'rhr', 'hrv', 'protein', 'gut', 'sun', 'exercise'];

  // ----- Mode 1 (Negative Cluster Alert) -----
  // Required: For the most recent 3 days: symptomScore >=4 AND >=2 non-symptom RED/YELLOW flags
  if (logs.length >= 3) {
    const last3 = logs.slice(-3);

    const mode1AllMatch = last3.every((log: any) => {
      const hasHighSymptoms = (log.symptomScore ?? 0) >= 4;
      const redYellowCount = metrics.filter((m) => {
        const flag = (log as any)[`${m}Flag`];
        return flag === 'RED' || flag === 'YELLOW';
      }).length;
      
      const matches = hasHighSymptoms && redYellowCount >= 2;
      return matches;
    });

    if (mode1AllMatch) {
      const hypothesis = generateHypothesis('negative', last3, metrics);
      
      const result = {
        mode: 'negative' as const,
        clusters: [['symptom', ...metrics.filter(m => last3.some(log => (log as any)[`${m}Flag`] === 'RED' || (log as any)[`${m}Flag`] === 'YELLOW'))]],
        hypothesis
      };

      writeDebugArtifact('detectClusters.mode1', userId, {
        days,
        endDate,
        startDate,
        last3: last3.map((l: any) => ({ date: l.date, symptomScore: l.symptomScore })),
        result,
      });
      
      return result;
    }
  }

  // ----- Mode 2 (Positive Cluster Alert) -----
  let mode2Match = false;
  if (logs.length >= 7) {
    const last7 = logs.slice(-7);
    const totalFlags = last7.length * metrics.length;
    const greenFlagsTotal = last7.reduce((sum: number, log: any) => {
      return sum + metrics.filter((m) => (log as any)[`${m}Flag`] === 'GREEN').length;
    }, 0);
    const avgSymptom = last7.reduce((sum, log) => sum + (log.symptomScore ?? 0), 0) / 7;
    mode2Match = (greenFlagsTotal / Math.max(1, totalFlags)) >= 0.8 && avgSymptom <= 2;
    if (mode2Match) {
      const hypothesis = generateHypothesis('positive', last7, metrics);
      return { mode: 'positive', clusters: [], hypothesis };
    }
  }

  // ----- Mode 3 (Stagnation Alert) -----
  // Stagnation requires Mode 1 and Mode 2 to be inactive.
  if (!mode2Match && logs.length >= 5) {
    const last5 = logs.slice(-5);
    const stableMetricCount = metrics.reduce((count: number, m: string) => {
      const flags = last5.map((log: any) => (log as any)[`${m}Flag`]);
      const allSame = flags.every((f) => f === flags[0]);
      return count + (allSame ? 1 : 0);
    }, 0);
    const mode3Match = (stableMetricCount / metrics.length) >= 0.7;
    if (mode3Match) {
      const hypothesis = generateHypothesis('stagnation', last5, metrics);
      return { mode: 'stagnation', clusters: [], hypothesis };
    }
  }
  
  const result = { mode: null, clusters: [], hypothesis: null };

  writeDebugArtifact('detectClusters.result', userId, { days, endDate, startDate, result });
  
  return result;
}

// Helper functions
function getDateDaysAgo(dateStr: string, daysAgo: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function calculateAverage(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function getMostFrequent<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let maxCount = 0;
  let mostFrequent = arr[0];
  counts.forEach((count, item) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = item;
    }
  });
  return mostFrequent;
}

function generateHypothesis(mode: 'negative' | 'positive' | 'stagnation', logs: any[], metrics: string[]): string {
  if (mode === 'negative') {
    const problemMetrics = metrics.filter(m => 
      logs.some(log => (log as any)[`${m}Flag`] === 'RED')
    );
    return `High symptoms with ${problemMetrics.join(', ')} issues detected. Consider improving ${problemMetrics[0]} habits.`;
  }
  
  if (mode === 'positive') {
    return 'Excellent health patterns detected. Continue current habits for sustained wellness.';
  }
  
  return 'Health patterns have plateaued. Consider introducing new wellness strategies.';
}
