import React, { Suspense } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { Lock, Sparkles, Moon, Heart, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, Legend, ComposedChart, Line } from 'recharts';
import { useLogs } from '@/hooks/useLogs';
import { useTargets } from '@/hooks/useTargets';
import { useActiveIntervention } from '@/hooks/useInterventions';

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

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  
  const { logs, isLoading: logsLoading } = useLogs(thirtyDaysAgo, today);
  
  // Debug: Check if we're getting real data
  React.useEffect(() => {
    if (logs && logs.length > 0) {
      console.log('[Dashboard] Real data loaded:', logs.length, 'logs');
      console.log('[Dashboard] Latest log:', logs[0]);
    } else if (!logsLoading) {
      console.log('[Dashboard] No logs found - showing empty state');
    }
  }, [logs, logsLoading]);
  const { targets } = useTargets();
  const { activeIntervention } = useActiveIntervention();

  if (logsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 text-center font-mono">
        <p className="text-muted-foreground">NO DATA LOGGED</p>
        <p className="text-sm text-muted-foreground mt-2">Go to Daily Log to record your first entry</p>
        <p className="text-xs text-muted-foreground/50 mt-4">Debug: {logsLoading ? 'Loading...' : 'No data from API'}</p>
      </div>
    );
  }

  const latestLog = logs[0];
  const last7Days = logs.slice(0, 7).reverse();

  const chartData = last7Days.map(log => ({
    name: format(parseISO(log.date), 'dd'),
    sleep: Number(log.sleep.toFixed(1)),
    rhr: Math.round(log.rhr),
    hrv: Math.round(log.hrv),
    protein: Math.round(log.protein),
    symptom: log.symptomScore
  }));

  // Circadian Rhythm Analysis - 4 key phases
  const circadianData = [
    {
      phase: 'Morning\nRecovery',
      recovery: Number(((latestLog.sleep / 9) * 100).toFixed(0)), // Sleep quality
      energy: Number(((latestLog.protein / (targets?.proteinTarget || 150)) * 100).toFixed(0)), // Nutrition
      stress: Math.max(0, 100 - (latestLog.symptomScore * 20)), // Inverted symptoms
    },
    {
      phase: 'Daytime\nActivity',
      recovery: Number(((latestLog.hrv / 100) * 100).toFixed(0)), // HRV recovery
      energy: Number(((latestLog.exercise / 5) * 100).toFixed(0)), // Exercise output
      stress: Math.max(0, 100 - ((latestLog.rhr - 50) * 2)), // RHR stress (lower is better)
    },
    {
      phase: 'Evening\nWind-down',
      recovery: Number(((latestLog.gut / 5) * 100).toFixed(0)), // Gut health
      energy: Number(((latestLog.sun / 5) * 100).toFixed(0)), // Sun exposure
      stress: Math.max(0, 100 - (latestLog.symptomScore * 20)), // Symptom load
    },
    {
      phase: 'Night\nRest',
      recovery: Number((((9 - Math.abs(latestLog.sleep - 8)) / 9) * 100).toFixed(0)), // Sleep optimization
      energy: Number(((latestLog.protein / (targets?.proteinTarget || 150)) * 100).toFixed(0)), // Protein recovery
      stress: Math.max(0, 100 - ((latestLog.rhr - 50) * 2)), // Resting state
    },
  ];

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500 pb-28">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm font-medium text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
        </div>

      </div>

      {/* BANNER SYSTEM */}
      <div className="w-full">
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
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-1">
                  Insight Available
                </h3>
                <p className="text-lg font-medium leading-snug">
                  Track your metrics for 7 days to establish baselines and unlock pattern detection.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CHARTS SECTION */}
      <div className="space-y-6">
        
        {/* CHART 1: Recovery Trends (Area) */}
        <div className="h-80 w-full bg-card/40 rounded-3xl border border-border/50 p-6 shadow-sm backdrop-blur-sm relative overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
               <Moon size={16} className="text-cyan-400" /> Sleep & HRV Trend
             </h2>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e879f9" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#e879f9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#9ca3af', fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{fontSize: 12, fill: '#9ca3af', fontWeight: 500}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'rgba(10,10,10,0.95)', color: 'white' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="sleep" stackId="1" stroke="#22d3ee" strokeWidth={3} fillOpacity={1} fill="url(#colorSleep)" />
                <Area type="monotone" dataKey="hrv" stackId="2" stroke="#e879f9" strokeWidth={3} fillOpacity={1} fill="url(#colorHrv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Circadian Rhythm Analysis (Polar) */}
        <div className="h-96 w-full bg-card/40 rounded-3xl border border-border/50 p-6 shadow-sm backdrop-blur-sm relative overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-2">
             <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
               <Zap size={16} className="text-purple-400" /> Circadian Rhythm
             </h2>
          </div>
          <div className="flex-1 min-h-0">
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={circadianData}>
                  <PolarGrid stroke="rgba(255,255,255,0.15)" gridType="polygon" />
                  <PolarAngleAxis 
                    dataKey="phase" 
                    tick={{ fill: '#a855f7', fontSize: 11, fontWeight: 600 }} 
                    className="text-purple-400"
                  />
                  <PolarRadiusAxis 
                    angle={0} 
                    domain={[0, 100]} 
                    tick={false} 
                    axisLine={false} 
                  />
                  <Radar
                    name="Recovery"
                    dataKey="recovery"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="#22c55e"
                    fillOpacity={0.2}
                  />
                  <Radar
                    name="Energy"
                    dataKey="energy"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="#f59e0b"
                    fillOpacity={0.2}
                  />
                  <Radar
                    name="Stress"
                    dataKey="stress"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="#ef4444"
                    fillOpacity={0.2}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid hsl(var(--border))', 
                      background: 'rgba(10,10,10,0.95)', 
                      color: 'white' 
                    }}
                    itemStyle={{ fontSize: '12px' }}
                    formatter={(value: any, name: string) => [
                      `${Math.round(value)}%`,
                      name === 'recovery' ? 'Recovery' : name === 'energy' ? 'Energy' : 'Stress'
                    ]}
                  />
                </RadarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 3: Recovery vs Strain (Composed) */}
        <div className="h-80 w-full bg-card/40 rounded-3xl border border-border/50 p-6 shadow-sm backdrop-blur-sm relative overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
               <Heart size={16} className="text-red-400" /> Cardiovascular Load
             </h2>
          </div>
          <div className="flex-1 min-h-0">
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: '#9ca3af', fontWeight: 500}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#9ca3af', fontWeight: 500}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#9ca3af', fontWeight: 500}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'rgba(10,10,10,0.95)', color: 'white' }}
                  />
                  <Bar yAxisId="left" dataKey="rhr" barSize={32} fill="#ef4444" opacity={0.8} radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="hrv" stroke="#22c55e" strokeWidth={4} dot={{r: 6, fill: '#0a0a0a', stroke: '#22c55e', strokeWidth: 3}} />
               </ComposedChart>
             </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* LATEST METRICS GRID */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 ml-1 flex items-center gap-2">
          Today's Metrics
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <MetricStatus label="Sleep" value={latestLog.sleep.toFixed(1)} unit="h" flag={latestLog.sleepFlag as Flag} />
          <MetricStatus label="RHR" value={Math.round(latestLog.rhr)} unit="bpm" flag={latestLog.rhrFlag as Flag} />
          <MetricStatus label="HRV" value={Math.round(latestLog.hrv)} unit="ms" flag={latestLog.hrvFlag as Flag} />
          
          <MetricStatus label="Protein" value={latestLog.protein} unit="g" flag={latestLog.proteinFlag as Flag} />
          <MetricStatus label="Gut" value={latestLog.gut} unit="/5" flag={latestLog.gutFlag as Flag} />
          <MetricStatus label="Symp" value={latestLog.symptomScore} unit="/5" flag={latestLog.symptomFlag as Flag} />
        </div>
      </div>

      {/* TRACEBACK HEATMAP (Lazy Loaded) */}
      <Suspense fallback={<HeatmapSkeleton />}>
        <Heatmap logs={logs as any} />
      </Suspense>

    </div>
  );
}
