export function toDate(d: string | Date | undefined | null): Date {
  if (!d) return new Date(NaN);
  if (d instanceof Date) return d;
  // Coerce strings safely
  const parsed = new Date(String(d));
  return parsed;
}

export function sortLogsDesc(logs: Array<{ date: string | Date }>) {
  return [...(logs || [])].sort((a, b) => {
    const da = toDate(a.date).getTime();
    const db = toDate(b.date).getTime();
    return db - da;
  });
}

export function getLastNDays(logs: Array<{ date: string | Date }>, n = 7) {
  const sorted = sortLogsDesc(logs);
  return sorted.slice(0, Math.min(n, sorted.length));
}

export default toDate;

export type NumericLog = {
  date: string | Date;
  sleep?: number | null;
  hrv?: number | null;
};

/**
 * Compute sensible Y domains for the AreaChart showing sleep and HRV.
 * - Sleep domain defaults to [0, 12], but will expand to fit observed sleep values up to 14.
 * - HRV domain defaults to [0, 100] but will use the max observed HRV rounded up to nearest 10.
 */
export function getAreaChartDomains(logs: NumericLog[] = []) {
  const sleeps = logs.map(l => (typeof l.sleep === 'number' ? l.sleep : NaN)).filter(n => !isNaN(n));
  const hrvs = logs.map(l => (typeof l.hrv === 'number' ? l.hrv : NaN)).filter(n => !isNaN(n));

  const maxSleepObserved = sleeps.length ? Math.max(...sleeps) : 8;
  const sleepUpper = Math.min(14, Math.max(8, Math.ceil(maxSleepObserved + 1)));

  const maxHrvObserved = hrvs.length ? Math.max(...hrvs) : 100;
  // Round up to nearest 10 for cleaner axis ticks
  const hrvUpper = Math.max(100, Math.ceil(maxHrvObserved / 10) * 10);

  return {
    sleepDomain: [0, sleepUpper] as [number, number],
    hrvDomain: [0, hrvUpper] as [number, number],
  };
}

export type Targets = {
  sleepBaseline?: number | null;
  rhrBaseline?: number | null;
  proteinTarget?: number | null;
  gutTarget?: number | null;
  sunTarget?: number | null;
  exerciseTarget?: number | null;
  hrvBaseline?: number | null;
};

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * A simple 0–100 recovery index based on wearable values vs baselines.
 * - Higher is better.
 * - Uses Sleep (higher better), HRV (higher better), RHR (lower better).
 */
export function computeRecoveryIndex(log: any = {}, targets: Targets | null = null) {
  const t = targets || {};

  const sleepBaseline = typeof t.sleepBaseline === 'number' && t.sleepBaseline > 0 ? t.sleepBaseline : 8;
  const hrvBaseline = typeof t.hrvBaseline === 'number' && t.hrvBaseline > 0 ? t.hrvBaseline : 100;
  const rhrBaseline = typeof t.rhrBaseline === 'number' && t.rhrBaseline > 0 ? t.rhrBaseline : 75;

  const safePositiveNumber = (v: any) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const sleep = safePositiveNumber(log?.sleep);
  const hrv = safePositiveNumber(log?.hrv);
  const rhr = safePositiveNumber(log?.rhr);

  // Convert ratios into bounded 0–100-ish scores (up to 120 for "above baseline").
  const parts: Array<{ score: number; weight: number }> = [];

  if (sleep !== null) {
    parts.push({ score: clamp((sleep / sleepBaseline) * 100, 0, 120), weight: 0.4 });
  }

  if (hrv !== null) {
    parts.push({ score: clamp((hrv / hrvBaseline) * 100, 0, 120), weight: 0.35 });
  }

  if (rhr !== null) {
    // Lower RHR is better: baseline/rhr
    parts.push({ score: clamp((rhrBaseline / rhr) * 100, 0, 120), weight: 0.25 });
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return 0;

  const weightedAvg = parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight;
  return Math.round(clamp(weightedAvg, 0, 100));
}

/**
 * Compute radar chart percentages for the System Balance chart.
 * Returns an array suitable for Recharts RadarChart where each item has { subject, A, fullMark }
 */
export function computeRadarPercentages(latestLog: any = {}, targets: Targets | null = null) {
  const t = targets || {};
  const sleepBaseline = typeof t.sleepBaseline === 'number' && t.sleepBaseline > 0 ? t.sleepBaseline : 8;
  const proteinTarget = typeof t.proteinTarget === 'number' && t.proteinTarget > 0 ? t.proteinTarget : 100;
  const gutTarget = typeof t.gutTarget === 'number' && t.gutTarget > 0 ? t.gutTarget : 5;
  const sunTarget = typeof t.sunTarget === 'number' && t.sunTarget > 0 ? t.sunTarget : 5;
  const exerciseTarget = typeof t.exerciseTarget === 'number' && t.exerciseTarget > 0 ? t.exerciseTarget : 5;
  const hrvBaseline = typeof t.hrvBaseline === 'number' && t.hrvBaseline > 0 ? t.hrvBaseline : 100;

  const safeNumber = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : 0);

  const sleepPct = Math.round((safeNumber(latestLog?.sleep) / sleepBaseline) * 100);
  const proteinPct = Math.round((safeNumber(latestLog?.protein) / proteinTarget) * 100);
  const gutPct = Math.round((safeNumber(latestLog?.gut) / gutTarget) * 100);
  const sunPct = Math.round((safeNumber(latestLog?.sun) / sunTarget) * 100);
  const exercisePct = Math.round((safeNumber(latestLog?.exercise) / exerciseTarget) * 100);
  const hrvPct = Math.round((safeNumber(latestLog?.hrv) / hrvBaseline) * 100);

  const clampPct = (n: number) => (isNaN(n) ? 0 : Math.max(0, Math.round(n)));

  return [
    { subject: 'Sleep', A: clampPct(sleepPct), fullMark: 100 },
    { subject: 'Protein', A: clampPct(proteinPct), fullMark: 100 },
    { subject: 'Gut', A: clampPct(gutPct), fullMark: 100 },
    { subject: 'Sun', A: clampPct(sunPct), fullMark: 100 },
    { subject: 'Exer', A: clampPct(exercisePct), fullMark: 100 },
    { subject: 'HRV', A: clampPct(hrvPct), fullMark: 100 },
  ];
}

/**
 * Compute domains for the ComposedChart (RHR bars and HRV line).
 * - rhrDomain: [0, upper] where upper = max(100, ceil(maxObserved + 10))
 * - hrvDomain: [0, upper] where upper = max(100, round up to nearest 10(maxObserved))
 */
export function getComposedChartDomains(logs: NumericLog[] = []) {
  const rhrs = logs.map(l => (typeof (l as any).rhr === 'number' ? (l as any).rhr : NaN)).filter(n => !isNaN(n));
  const hrvs = logs.map(l => (typeof (l as any).hrv === 'number' ? (l as any).hrv : NaN)).filter(n => !isNaN(n));

  const maxRhr = rhrs.length ? Math.max(...rhrs) : 75;
  const rhrUpper = Math.max(100, Math.ceil(maxRhr + 10));

  const maxHrv = hrvs.length ? Math.max(...hrvs) : 100;
  const hrvUpper = Math.max(100, Math.ceil(maxHrv / 10) * 10);

  return {
    rhrDomain: [0, rhrUpper] as [number, number],
    hrvDomain: [0, hrvUpper] as [number, number],
  };
}
