import React from 'react';
import { useStore, Flag } from '@/lib/store';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, TrendingUp, Lock, Sparkles } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

// Re-usable small components for the dashboard

const MetricStatus = ({ label, value, flag, unit }: { label: string, value: string | number, flag: Flag, unit?: string }) => {
  const colorClass = 
    flag === 'RED' ? 'text-flag-red bg-flag-red/5 border-flag-red/20' :
    flag === 'YELLOW' ? 'text-flag-yellow bg-flag-yellow/5 border-flag-yellow/20' :
    'text-flag-green bg-flag-green/5 border-flag-green/20';
  
  return (
    <div className={`border p-4 flex flex-col justify-between h-28 rounded-2xl backdrop-blur-sm transition-all hover:scale-[1.02] ${colorClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold tracking-tighter">{value}</span>
        {unit && <span className="text-xs mb-1 opacity-70 font-medium">{unit}</span>}
      </div>
    </div>
  );
};

const HeatmapCell = ({ flag }: { flag: Flag }) => {
  const color = 
    flag === 'RED' ? 'bg-flag-red' :
    flag === 'YELLOW' ? 'bg-flag-yellow' :
    'bg-flag-green';
    
  return <div className={`w-full aspect-square ${color} rounded-sm opacity-90 hover:opacity-100 transition-opacity`} />;
};

export default function Dashboard() {
  const { logs, activeIntervention } = useStore();

  // Get latest log
  const latestLog = logs[logs.length - 1];
  
  // Chart data preparation
  const chartData = logs.slice(-7).map(log => ({
    name: format(parseISO(log.date), 'dd'),
    sleep: log.rawValues.sleep,
    rhr: log.rawValues.rhr,
    hrv: log.rawValues.hrv
  }));
  
  if (!latestLog) return <div className="p-8 text-center font-mono">NO DATA LOGGED</div>;

  const { processedState, rawValues } = latestLog;

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
        <div className="bg-card/50 px-3 py-1.5 rounded-full border border-border/50 backdrop-blur-md">
          <div className="text-xs font-bold text-flag-green flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-flag-green animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            System Active
          </div>
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
                  Testing: "{activeIntervention.text}"
                </p>
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-background/30 px-2 py-1 rounded-md w-fit">
                  <span>ENDS</span>
                  <span className="text-foreground">{format(parseISO(activeIntervention.endDate), 'MMM dd')}</span>
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
                  Your Sleep Duration is stabilizing. Maintain current protein intake to support RHR recovery.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CHART SECTION */}
      <div className="h-64 w-full bg-card/50 rounded-3xl border border-border/50 p-4 shadow-sm backdrop-blur-sm relative overflow-hidden">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 ml-2">7-Day Bio-Trends</h2>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(220 70% 50%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(220 70% 50%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160 60% 45%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(160 60% 45%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="name" tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
              itemStyle={{ fontSize: '12px', fontWeight: 500 }}
            />
            <Area type="monotone" dataKey="sleep" stroke="hsl(220 70% 50%)" strokeWidth={2} fillOpacity={1} fill="url(#colorSleep)" />
            <Area type="monotone" dataKey="hrv" stroke="hsl(160 60% 45%)" strokeWidth={2} fillOpacity={1} fill="url(#colorHrv)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* LATEST METRICS GRID */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 ml-1 flex items-center gap-2">
          Today's Metrics
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <MetricStatus label="Sleep" value={rawValues.sleep.toFixed(1)} unit="h" flag={processedState.sleep} />
          <MetricStatus label="RHR" value={Math.round(rawValues.rhr)} unit="bpm" flag={processedState.rhr} />
          <MetricStatus label="HRV" value={Math.round(rawValues.hrv)} unit="ms" flag={processedState.hrv} />
          
          <MetricStatus label="Protein" value={rawValues.protein} unit="g" flag={processedState.protein} />
          <MetricStatus label="Gut" value={rawValues.gut} unit="/5" flag={processedState.gut} />
          <MetricStatus label="Symp" value={rawValues.symptomScore} unit="/5" flag={processedState.symptomScore} />
        </div>
      </div>

      {/* TRACEBACK HEATMAP */}
      <div className="pt-2 bg-card/30 rounded-3xl border border-border/50 p-6">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          14-Day Traceback Matrix
        </h2>
        
        {/* Matrix Header */}
        <div className="grid grid-cols-[auto_1fr] gap-4">
           {/* Row Labels */}
           <div className="flex flex-col justify-between py-1 text-[10px] font-bold text-muted-foreground text-right gap-1.5">
             <div>SLP</div>
             <div>RHR</div>
             <div>HRV</div>
             <div>PRO</div>
             <div>GUT</div>
             <div>SUN</div>
             <div>EXE</div>
             <div>SYM</div>
           </div>

           {/* The Grid */}
           <div className="grid grid-cols-14 gap-1">
             {/* We need to map metrics to rows */}
             {['sleep', 'rhr', 'hrv', 'protein', 'gut', 'sun', 'exercise', 'symptomScore'].map((metric) => (
               <React.Fragment key={metric}>
                 {logs.slice(-14).map((log, i) => (
                   <HeatmapCell 
                    key={i} 
                    flag={log.processedState[metric as keyof typeof log.processedState] || 'GREEN'} 
                   />
                 ))}
               </React.Fragment>
             ))}
           </div>
        </div>
        
        <div className="flex justify-end gap-4 mt-4">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-flag-green"></div>
             <span className="text-[10px] font-bold text-muted-foreground tracking-wide">OPTIMAL</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-flag-yellow"></div>
             <span className="text-[10px] font-bold text-muted-foreground tracking-wide">DEV</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-flag-red"></div>
             <span className="text-[10px] font-bold text-muted-foreground tracking-wide">CRIT</span>
           </div>
        </div>
      </div>

    </div>
  );
}
