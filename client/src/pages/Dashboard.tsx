import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Lock, Sparkles, Moon, Heart, Zap, RotateCcw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Bar, ComposedChart, Line } from 'recharts';
import { useLogs } from '@/hooks/useLogs';
import { toDate, getLastNDays, getAreaChartDomains, getComposedChartDomains, computeRecoveryIndex } from '@/components/charts/helpers';
import ChartSkeleton from '@/components/ui/chart-skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useTargets } from '@/hooks/useTargets';
import { useActiveIntervention } from '@/hooks/useInterventions';
import { useNotifications } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useEntitlements } from '@/hooks/useEntitlements';
import { FeatureGate } from '@/components/FeatureGate';
import { useLocation } from 'wouter';

const Heatmap = React.lazy(() => import('@/components/Heatmap'));

type Flag = 'GREEN' | 'YELLOW' | 'RED';

const MetricStatus = ({ label, value, flag, unit }: { label: string, value: string | number, flag: Flag, unit?: string }) => {
  const colorClass = 
    flag === 'RED' ? 'text-flag-red bg-flag-red/5 border-flag-red/20' :
    flag === 'YELLOW' ? 'text-flag-yellow bg-flag-yellow/5 border-flag-yellow/20' :
    'text-flag-green bg-flag-green/5 border-flag-green/20';
  
  return (
    <div className={`border p-4 flex flex-col justify-between h-28 rounded-2xl backdrop-blur-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${colorClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold tracking-tighter">{value}</span>
        {unit && <span className="text-xs mb-1 opacity-70 font-medium">{unit}</span>}
      </div>
    </div>
  );
};

const HeatmapSkeleton = () => (
  <div className="pt-2 bg-card/30 rounded-3xl border border-border/50 p-6 h-[280px] animate-pulse flex flex-col justify-center items-center">
    <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin mb-2" />
    <span className="text-xs font-mono text-muted-foreground">Loading Matrix...</span>
  </div>
);

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(Boolean(mql.matches));
    onChange();
    try {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } catch {
      // Safari < 14
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);
  return reduced;
};

const FlipBody = ({ flipped, front, back, reduceMotion }: { flipped: boolean; front: React.ReactNode; back: React.ReactNode; reduceMotion: boolean }) => {
  if (reduceMotion) {
    return <div className="flex-1 min-h-0">{flipped ? back : front}</div>;
  }
  return (
    <div className="flex-1 min-h-0 [perspective:1000px]">
      <div
        className={`relative h-full w-full transition-transform motion-reduce:transition-none duration-500 [transform-style:preserve-3d] ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">{front}</div>
        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">{back}</div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { plan, entitlements } = useEntitlements();
  const reduceMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const { startDate, endDate, headerDate } = useMemo(() => {
    const now = new Date();
    const historyWindow = entitlements.historyDays || 14;
    const end = format(now, 'yyyy-MM-dd');
    const start = format(subDays(now, historyWindow - 1), 'yyyy-MM-dd');
    return { startDate: start, endDate: end, headerDate: format(now, 'EEEE, MMMM do') };
  }, [entitlements.historyDays]);

  const { logs, isLoading: logsLoading, isFetching: logsFetching, error: logsError } = useLogs(startDate, endDate);
  const { targets } = useTargets();
  const { activeIntervention } = useActiveIntervention();
  const { data: insights } = useQuery({
    queryKey: ['insights'],
    queryFn: api.getInsights,
    enabled: Boolean(entitlements.canViewInsights && !activeIntervention && (logs?.length || 0) > 0),
    staleTime: 30_000,
  });
  const queryClient = useQueryClient();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [flip, setFlip] = useState<{ sleepHrv: boolean; insight: boolean; cardio: boolean; heatmap: boolean }>({
    sleepHrv: false,
    insight: false,
    cardio: false,
    heatmap: false,
  });
  const notify = useNotifications();

  const hasLogs = (logs?.length || 0) > 0;

  if (!logsLoading && !hasLogs) {
    return (
      <div className="p-8 text-center font-mono">
        <p className="text-muted-foreground">NO DATA LOGGED</p>
        <p className="text-sm text-muted-foreground mt-2">Go to Daily Log to record your first entry</p>
      </div>
    );
  }

  // Normalize and sort logs (newest first) then pick last N days based on entitlement
  const sortedLogs = useMemo(() => (logs ? getLastNDays(logs, entitlements.historyDays || 14) : []), [logs, entitlements.historyDays]);
  const last7DaysRaw = useMemo(
    () => sortedLogs.slice(0, Math.min(7, sortedLogs.length)),
    [sortedLogs]
  );
  const last7Days = useMemo(() => last7DaysRaw.slice().reverse(), [last7DaysRaw]);
  const latestLog = sortedLogs[0];

  // Compute Y axis domains for the AreaChart (sleep & HRV)
  const { sleepDomain, hrvDomain } = useMemo(
    () => getAreaChartDomains(last7DaysRaw as any),
    [last7DaysRaw]
  );

  const chartData = useMemo(
    () =>
      last7Days.map((log, index) => {
        const d = toDate(log.date);
        const name = isNaN(d.getTime()) ? `D${index + 1}` : format(d, 'MMM dd');
        return {
          name,
          sleep: typeof (log as any).sleep === 'number' ? Number((log as any).sleep.toFixed(1)) : Number((log as any).sleep || 0),
          rhr: Math.round(Number((log as any).rhr || 0)),
          hrv: Math.round(Number((log as any).hrv || 0)),
          protein: Math.round(Number((log as any).protein || 0)),
          symptom: (log as any).symptomScore ?? 0,
          recoveryIndex: computeRecoveryIndex(log as any, targets as any),
        };
      }),
    [last7Days, targets]
  );

  // Domains and sizing for ComposedChart (RHR bars and HRV line)
  const composedDomains = useMemo(() => getComposedChartDomains(last7DaysRaw as any), [last7DaysRaw]);
  const composedBarSize = useMemo(
    () => Math.min(48, Math.max(12, Math.floor(240 / Math.max(1, chartData.length)))),
    [chartData.length]
  );

  const handleCheckin = useCallback(
    async (result: 'Yes' | 'No' | 'Partial') => {
      if (!activeIntervention?.id) return;
      setIsCheckingIn(true);
      setCheckinError(null);
      try {
        await api.checkInIntervention(activeIntervention.id, result);
        await queryClient.invalidateQueries({ queryKey: ['activeIntervention'] });
        await queryClient.invalidateQueries({ queryKey: ['interventions'] });
        notify.success('Check-in recorded — thank you!', 'Thanks for completing the check-in.');
      } catch (err: any) {
        const msg = String(err?.message || 'Check-in failed');
        setCheckinError(msg);
        notify.error('Check-in failed', msg);
      } finally {
        setIsCheckingIn(false);
      }
    },
    [activeIntervention?.id, queryClient, notify]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-12 animate-in fade-in duration-500 pb-32">
      
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            {headerDate}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 sm:px-3 py-1 rounded-full border border-white/10 bg-white/5 text-foreground font-semibold text-[10px] sm:text-xs">
            Plan: {plan === 'pro' ? 'Pro' : 'Free'}
          </span>
          {plan === 'free' && (
            <button
              type="button"
              onClick={() => setLocation('/upgrade')}
              className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-emerald-500/25"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* BANNER SYSTEM */}
      <div className="w-full space-y-3">
        {logsError && (
          <div role="alert" className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <div className="text-sm font-medium text-rose-500">Failed to load dashboard data.</div>
            <div className="text-xs text-muted-foreground mt-1">{String((logsError as any)?.message || logsError)}</div>
          </div>
        )}

        <FeatureGate
          allowed={entitlements.canViewInsights}
          label="Insights are Pro"
          ctaLabel="Upgrade"
          onUpgrade={() => setLocation('/upgrade')}
        >
          {activeIntervention ? (
            <div className="rounded-3xl border border-flag-yellow/30 bg-flag-yellow/5 p-6 relative overflow-hidden group shadow-[0_0_30px_rgba(234,179,8,0.05)]">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Lock size={120} />
              </div>
              <div className="flex items-start gap-4 relative z-10">
                <div className="bg-flag-yellow/20 p-2.5 rounded-xl">
                  <Lock className="w-6 h-6 text-flag-yellow" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-flag-yellow uppercase tracking-wider mb-1">
                    Intervention Active
                  </h3>
                  <p className="text-lg font-medium leading-tight mb-2 text-foreground">
                    Testing: "{activeIntervention.hypothesisText}"
                  </p>
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-background/30 px-2 py-1 rounded-md w-fit">
                    <span>ENDS</span>
                    <span className="text-foreground">{format(new Date(activeIntervention.endDate), 'MMM dd')}</span>
                  </div>
                    {/* Minimal Check-in UI: show when endDate has passed */}
                    {new Date(activeIntervention.endDate).getTime() <= Date.now() && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground mb-2">Intervention period complete — how did it go?</div>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-1 rounded-md bg-flag-green text-black text-sm font-medium disabled:opacity-50"
                            disabled={isCheckingIn}
                            onClick={() => handleCheckin('Yes')}
                          >
                            It worked ✅
                          </button>
                          <button
                            className="px-3 py-1 rounded-md bg-flag-red text-white text-sm font-medium disabled:opacity-50"
                            disabled={isCheckingIn}
                            onClick={() => handleCheckin('No')}
                          >
                            Not helpful ✖️
                          </button>
                          <button
                            className="px-3 py-1 rounded-md bg-amber-400 text-black text-sm font-medium disabled:opacity-50"
                            disabled={isCheckingIn}
                            onClick={() => handleCheckin('Partial')}
                          >
                            Partially 🟡
                          </button>
                        </div>
                        {checkinError && <div className="text-xs text-red-500 mt-2">{checkinError}</div>}
                      </div>
                    )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                <Sparkles size={120} />
              </div>
              <div className="flex items-start gap-4 relative z-10">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Sparkles className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  {!targets?.isBaselineComplete ? (
                    <>
                      <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-1">
                        Gathering Data
                      </h3>
                      <p className="text-lg font-medium leading-snug">
                        Insights are provisional based on population averages.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-1">
                        Action Required
                      </h3>
                      <p className="text-lg font-medium leading-snug">
                        {insights?.hypothesis || 'Analyzing your recent patterns…'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </FeatureGate>
      </div>

      {/* LATEST METRICS GRID */}
      <div>
        <h2 className="mono-section-label mb-4 ml-1 flex items-center gap-2">
          Today's Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {!hasLogs && logsLoading ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-28 rounded-2xl border border-border/50 bg-card/30 animate-pulse" />
            ))
          ) : (
            <>
              <MetricStatus label="Sleep" value={(latestLog as any).sleep?.toFixed?.(1) ?? '--'} unit="h" flag={((latestLog as any)?.sleepFlag as Flag) || 'GREEN'} />
              <MetricStatus label="RHR" value={Math.round(Number((latestLog as any)?.rhr || 0))} unit="bpm" flag={((latestLog as any)?.rhrFlag as Flag) || 'GREEN'} />
              <MetricStatus label="HRV" value={Math.round(Number((latestLog as any)?.hrv || 0))} unit="ms" flag={((latestLog as any)?.hrvFlag as Flag) || 'GREEN'} />
              <MetricStatus label="Protein" value={Math.round(Number((latestLog as any)?.protein || 0))} unit="g" flag={((latestLog as any)?.proteinFlag as Flag) || 'GREEN'} />
              <MetricStatus label="Gut" value={Math.round(Number((latestLog as any)?.gut || 0))} unit="/5" flag={((latestLog as any)?.gutFlag as Flag) || 'GREEN'} />
              <MetricStatus label="Symp" value={Math.round(Number((latestLog as any)?.symptomScore || 0))} unit="/5" flag={((latestLog as any)?.symptomFlag as Flag) || 'GREEN'} />
            </>
          )}
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="space-y-12">
        {/* CHART 1: Recovery Trends (Area) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 px-1">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-300/80 font-semibold">Recovery trend</p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Moon size={18} className="text-cyan-300" /> Sleep & HRV stability
                {plan === 'free' && <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">Pro</span>}
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">A balanced view of sleep hours and HRV across the last 7 days to spot consistency or dips.</p>
            </div>
            <button
              type="button"
              onClick={() => setFlip((s) => ({ ...s, sleepHrv: !s.sleepHrv }))}
              aria-label={flip.sleepHrv ? 'Show Sleep & HRV Trend chart' : 'Show explanation for Sleep & HRV Trend'}
              aria-pressed={flip.sleepHrv}
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur"
            >
              <RotateCcw size={14} /> {flip.sleepHrv ? 'Back to chart' : 'How to read'}
            </button>
          </div>
          <FeatureGate
            allowed={entitlements.canViewInsights}
            label="Charts are Pro"
            ctaLabel="Upgrade"
            onUpgrade={() => setLocation('/upgrade')}
          >
            <div
              className="min-h-[420px] sm:min-h-[500px] w-full rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-900/50 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.8)] p-4 sm:p-6 lg:p-8 relative overflow-hidden flex flex-col select-none"
              onClick={() => setFlip((s) => ({ ...s, sleepHrv: !s.sleepHrv }))}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(232,121,249,0.08),transparent_30%)]" />
              <FlipBody
                flipped={flip.sleepHrv}
                reduceMotion={reduceMotion}
                front={
                  <div className="h-full relative z-10" onClick={(e) => e.stopPropagation()}>
                    <ErrorBoundary fallback={<ChartSkeleton height={360} />}>
                      {(!hasLogs && logsLoading) || chartData.length < 2 ? (
                        <ChartSkeleton height={360} />
                      ) : (
                        <div className="h-[360px] sm:h-[460px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: isMobile ? 8 : 14, left: isMobile ? 8 : -4, bottom: isMobile ? 25 : 18 }}>
                              <defs>
                                <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6}/>
                                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#e879f9" stopOpacity={0.6}/>
                                  <stop offset="95%" stopColor="#e879f9" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="rgba(255,255,255,0.08)" />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: 'rgba(226,232,240,0.8)', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                angle={-22}
                                textAnchor="end"
                                height={42}
                                tickMargin={10}
                              />
                              <YAxis
                                yAxisId="left"
                                domain={sleepDomain}
                                tick={{ fontSize: 12, fill: 'rgba(226,232,240,0.9)', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                tickCount={6}
                                label={isMobile ? undefined : { value: 'Sleep (h)', angle: -90, position: 'insideLeft', fill: 'rgba(226,232,240,0.9)', fontSize: 11 }}
                              />
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                domain={hrvDomain}
                                tick={{ fontSize: 12, fill: 'rgba(226,232,240,0.9)', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                tickCount={6}
                                label={isMobile ? undefined : { value: 'HRV (ms)', angle: 90, position: 'insideRight', fill: 'rgba(226,232,240,0.9)', fontSize: 11 }}
                              />
                              <Tooltip 
                                contentStyle={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.95)', color: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
                                itemStyle={{ fontSize: '12px', fontWeight: 700 }}
                              />
                              <Area type="monotone" dataKey="sleep" yAxisId="left" stroke="#22d3ee" strokeWidth={3} fillOpacity={1} fill="url(#colorSleep)" />
                              <Area type="monotone" dataKey="hrv" yAxisId="right" stroke="#e879f9" strokeWidth={3} fillOpacity={1} fill="url(#colorHrv)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </ErrorBoundary>
                  </div>
                }
                back={
                  <div className="h-full min-h-[360px] sm:min-h-[460px] rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6 lg:p-7 overflow-auto relative z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="mono-section-label mb-3 text-cyan-200/80">How to read this</div>
                    <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
                      <div><span className="font-semibold text-white">Sleep</span> should stay steady; sharp drops for a couple of days usually pair with higher strain or symptoms.</div>
                      <div><span className="font-semibold text-white">HRV</span> rising versus your baseline is a good sign of recovery; falling for several days suggests backing off.</div>
                      <div className="text-xs text-slate-300/80">Tip: line up dips here with the 14-day matrix and symptom trend to catch patterns early.</div>
                    </div>
                  </div>
                }
              />
            </div>
          </FeatureGate>
        </div>

        {/* CHART 2: Recovery Index vs Symptoms (Composed) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 px-1">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-300/80 font-semibold">Recovery vs symptoms</p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Zap size={18} className="text-emerald-300" /> Signal vs friction
                {plan === 'free' && <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">Pro</span>}
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">See how the combined recovery index moves against your symptom score to highlight warning days.</p>
            </div>
            <button
              type="button"
              onClick={() => setFlip((s) => ({ ...s, insight: !s.insight }))}
              aria-label={flip.insight ? 'Show Recovery Index vs Symptoms chart' : 'Show explanation for Recovery Index vs Symptoms'}
              aria-pressed={flip.insight}
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur"
            >
              <RotateCcw size={14} /> {flip.insight ? 'Back to chart' : 'How to read'}
            </button>
          </div>
          <FeatureGate
            allowed={entitlements.canViewInsights}
            label="Charts are Pro"
            ctaLabel="Upgrade"
            onUpgrade={() => setLocation('/upgrade')}
          >
            <div
              className="min-h-[440px] sm:min-h-[520px] w-full rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-900/50 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.8)] p-4 sm:p-6 lg:p-8 relative overflow-hidden flex flex-col select-none"
              onClick={() => setFlip((s) => ({ ...s, insight: !s.insight }))}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_10%,rgba(74,222,128,0.1),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.1),transparent_32%)]" />
              <FlipBody
                flipped={flip.insight}
                reduceMotion={reduceMotion}
                front={
                  <div className="h-full relative z-10" onClick={(e) => e.stopPropagation()}>
                    <ErrorBoundary fallback={<ChartSkeleton height={380} />}>
                      {(!hasLogs && logsLoading) || chartData.length < 2 ? (
                        <ChartSkeleton height={380} />
                      ) : (
                        <div className="h-[400px] sm:h-[500px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 12, right: isMobile ? 12 : 18, left: isMobile ? 15 : 10, bottom: isMobile ? 28 : 22 }} role="img" aria-label="Recovery index vs symptom score chart">
                              <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="rgba(255,255,255,0.08)" />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: 'rgba(226,232,240,0.8)', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                angle={-22}
                                textAnchor="end"
                                height={44}
                                tickMargin={12}
                              />
                              <YAxis
                                yAxisId="left"
                                domain={[0, 100]}
                                tick={{ fontSize: 12, fill: 'rgba(226,232,240,0.9)', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                tickCount={isMobile ? 4 : 6}
                                label={isMobile ? undefined : { value: 'Recovery (0-100)', angle: -90, position: 'insideLeft', fill: 'rgba(226,232,240,0.9)', fontSize: 11 }}
                              />
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                domain={[0, 5]}
                                tick={isMobile ? false : ({ fontSize: 12, fill: 'rgba(226,232,240,0.9)', fontWeight: 600 } as any)}
                                axisLine={false}
                                tickLine={false}
                                tickCount={isMobile ? 4 : 6}
                                label={isMobile ? undefined : { value: 'Symptoms (0-5)', angle: 90, position: 'insideRight', fill: 'rgba(226,232,240,0.9)', fontSize: 11 }}
                              />
                              <Tooltip
                                contentStyle={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.95)', color: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
                                itemStyle={{ fontSize: '12px', fontWeight: 700 }}
                              />
                              <Line
                                name="Recovery Index"
                                yAxisId="left"
                                type="monotone"
                                dataKey="recoveryIndex"
                                stroke="#4ade80"
                                strokeWidth={3.5}
                                dot={false}
                                activeDot={{ r: 6, fill: '#0f172a', stroke: '#4ade80', strokeWidth: 3 }}
                              />
                              <Line
                                name="Symptom Score"
                                yAxisId="right"
                                type="monotone"
                                dataKey="symptom"
                                stroke="#f97316"
                                strokeWidth={3.5}
                                dot={false}
                                activeDot={{ r: 6, fill: '#0f172a', stroke: '#f97316', strokeWidth: 3 }}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </ErrorBoundary>
                  </div>
                }
                back={
                  <div className="h-full min-h-[400px] sm:min-h-[500px] rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6 lg:p-7 overflow-auto relative z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="mono-section-label mb-3 text-emerald-200/80">How to read this</div>
                    <div className="space-y-3 text-sm leading-relaxed text-slate-200">
                      <div><span className="font-semibold text-white">Recovery Index</span> aggregates sleep, HRV, and RHR versus your baselines. Up and flat is ideal.</div>
                      <div><span className="font-semibold text-white">Symptoms</span> trending up while recovery drifts down is an early warning to rest or adjust load.</div>
                      <div className="text-xs text-slate-300/80">Watch for crossover days where symptoms spike above 3 while recovery slips under 60.</div>
                    </div>
                  </div>
                }
              />
            </div>
          </FeatureGate>
        </div>

        {/* CHART 3: Recovery vs Strain (Composed) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 px-1">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.35em] text-rose-300/80 font-semibold">Cardio load</p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Heart size={18} className="text-rose-300" /> RHR load vs HRV response
                {plan === 'free' && <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">Pro</span>}
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">Bar and line together show how resting heart rate and HRV respond to your recent strain.</p>
            </div>
            <button
              type="button"
              onClick={() => setFlip((s) => ({ ...s, cardio: !s.cardio }))}
              aria-label={flip.cardio ? 'Show Cardiovascular Load chart' : 'Show explanation for Cardiovascular Load'}
              aria-pressed={flip.cardio}
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur"
            >
              <RotateCcw size={14} /> {flip.cardio ? 'Back to chart' : 'How to read'}
            </button>
          </div>
          <FeatureGate
            allowed={entitlements.canViewInsights}
            label="Charts are Pro"
            ctaLabel="Upgrade"
            onUpgrade={() => setLocation('/upgrade')}
          >
            <div
              className="min-h-[420px] sm:min-h-[500px] w-full rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-900/50 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.8)] p-4 sm:p-6 lg:p-8 relative overflow-hidden flex flex-col select-none"
              onClick={() => setFlip((s) => ({ ...s, cardio: !s.cardio }))}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_8%,rgba(239,68,68,0.12),transparent_32%),radial-gradient(circle_at_85%_12%,rgba(34,197,94,0.12),transparent_32%)]" />
              <FlipBody
                flipped={flip.cardio}
                reduceMotion={reduceMotion}
                front={
                  <div className="h-full relative z-10" onClick={(e) => e.stopPropagation()}>
                    <ErrorBoundary fallback={<ChartSkeleton height={340} />}>
                      {(!hasLogs && logsLoading) || chartData.length < 1 ? (
                        <ChartSkeleton height={340} />
                      ) : (
                        <div className="h-[360px] sm:h-[460px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 12, right: isMobile ? 8 : 12, left: isMobile ? 8 : -2, bottom: isMobile ? 25 : 20 }} role="img" aria-label="Cardiovascular load chart">
                              <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="rgba(255,255,255,0.08)" />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: 'rgba(226,232,240,0.8)', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                angle={-22}
                                textAnchor="end"
                                height={42}
                                tickMargin={10}
                              />
                              <YAxis
                                yAxisId="left"
                                domain={composedDomains.rhrDomain}
                                tick={{fontSize: 12, fill: 'rgba(226,232,240,0.9)', fontWeight: 600}}
                                axisLine={false}
                                tickLine={false}
                                tickCount={6}
                                label={isMobile ? undefined : { value: 'RHR (bpm)', angle: -90, position: 'insideLeft', fill: 'rgba(226,232,240,0.9)', fontSize: 11 }}
                              />
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                domain={composedDomains.hrvDomain}
                                tick={{fontSize: 12, fill: 'rgba(226,232,240,0.9)', fontWeight: 600}}
                                axisLine={false}
                                tickLine={false}
                                tickCount={6}
                                label={isMobile ? undefined : { value: 'HRV (ms)', angle: 90, position: 'insideRight', fill: 'rgba(226,232,240,0.9)', fontSize: 11 }}
                              />
                              <Tooltip 
                                contentStyle={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.95)', color: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
                              />
                              <Bar yAxisId="left" dataKey="rhr" barSize={composedBarSize + 6} fill="#ef4444" opacity={0.9} radius={[10, 10, 4, 4]} />
                              <Line yAxisId="right" type="monotone" dataKey="hrv" stroke="#22c55e" strokeWidth={4} dot={{r: 6, fill: '#0f172a', stroke: '#22c55e', strokeWidth: 3}} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </ErrorBoundary>
                  </div>
                }
                back={
                  <div className="h-full min-h-[360px] sm:min-h-[460px] rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6 lg:p-7 overflow-auto relative z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="mono-section-label mb-3 text-rose-200/80">How to read this</div>
                    <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
                      <div><span className="font-semibold text-white">RHR bars</span> climbing across days often signal fatigue or load accumulation.</div>
                      <div><span className="font-semibold text-white">HRV line</span> dipping while RHR climbs is a paired stress signal; consider dialing back intensity.</div>
                      <div className="text-xs text-slate-300/80">Look for the combo: tall red bars with a falling green line over 2–3 days.</div>
                    </div>
                  </div>
                }
              />
            </div>
          </FeatureGate>
        </div>

      </div>

      {/* TRACEBACK HEATMAP (Lazy Loaded) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4 px-1">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-300/80 font-semibold">Traceback matrix</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              14-day recovery heatmap
              {plan === 'free' && <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">Pro</span>}
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">Eight metrics side-by-side to spot streaks, misses, and the moments symptoms start brewing.</p>
          </div>
          <button
            type="button"
            onClick={() => setFlip((s) => ({ ...s, heatmap: !s.heatmap }))}
            aria-label={flip.heatmap ? 'Show 14-Day Traceback Matrix' : 'Show explanation for 14-Day Traceback Matrix'}
            aria-pressed={flip.heatmap}
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur"
          >
            <RotateCcw size={14} /> {flip.heatmap ? 'Back to matrix' : 'How to read'}
          </button>
        </div>
        <FeatureGate
          allowed={entitlements.canViewInsights}
          label="Heatmap is Pro"
          ctaLabel="Upgrade"
          onUpgrade={() => setLocation('/upgrade')}
        >
          <Suspense fallback={<HeatmapSkeleton />}>
            {!hasLogs && logsLoading ? <HeatmapSkeleton /> : <Heatmap logs={logs as any} flipped={flip.heatmap} />}
          </Suspense>
        </FeatureGate>
      </div>

    </div>
  );
}
