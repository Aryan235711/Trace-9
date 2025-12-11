import React from 'react';
import { useStore, Flag } from '@/lib/store';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, TrendingUp, Lock } from 'lucide-react';

// Re-usable small components for the dashboard

const MetricStatus = ({ label, value, flag, unit }: { label: string, value: string | number, flag: Flag, unit?: string }) => {
  const colorClass = 
    flag === 'RED' ? 'text-flag-red border-flag-red/50 bg-flag-red/5' :
    flag === 'YELLOW' ? 'text-flag-yellow border-flag-yellow/50 bg-flag-yellow/5' :
    'text-flag-green border-flag-green/50 bg-flag-green/5';
  
  return (
    <div className={`border p-3 flex flex-col justify-between h-24 ${colorClass}`}>
      <span className="text-[10px] font-mono uppercase opacity-80">{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {unit && <span className="text-xs mb-1 opacity-70 font-mono">{unit}</span>}
      </div>
    </div>
  );
};

const HeatmapCell = ({ flag }: { flag: Flag }) => {
  const color = 
    flag === 'RED' ? 'bg-flag-red' :
    flag === 'YELLOW' ? 'bg-flag-yellow' :
    'bg-flag-green';
    
  return <div className={`w-full aspect-square ${color} opacity-90 hover:opacity-100 transition-opacity`} />;
};

export default function Dashboard() {
  const { logs, activeIntervention } = useStore();

  // Get latest log
  const latestLog = logs[logs.length - 1];
  
  if (!latestLog) return <div className="p-8 text-center font-mono">NO DATA LOGGED</div>;

  const { processedState, rawValues } = latestLog;

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tighter">DASHBOARD</h1>
          <p className="text-xs font-mono text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM do').toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-muted-foreground">STATUS</div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-flag-green animate-pulse" />
            ONLINE
          </div>
        </div>
      </div>

      {/* BANNER SYSTEM */}
      <div className="w-full">
        {activeIntervention ? (
          <div className="border border-white bg-card p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Lock size={64} />
            </div>
            <div className="flex items-start gap-3 relative z-10">
              <Lock className="w-5 h-5 text-flag-yellow shrink-0 mt-1" />
              <div>
                <h3 className="font-mono text-xs font-bold text-flag-yellow uppercase mb-1">
                  Intervention Locked
                </h3>
                <p className="text-sm font-medium leading-tight mb-2">
                  Testing: "{activeIntervention.text}"
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  Ends on {format(parseISO(activeIntervention.endDate), 'MMM dd')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-white bg-white text-black p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 shrink-0 mt-1" />
              <div>
                <h3 className="font-mono text-xs font-bold uppercase mb-1">
                  Trace-9 Insight
                </h3>
                <p className="text-sm font-bold leading-tight">
                  Your Sleep Duration is stabilizing. Recommendation: Maintain current protein intake to support RHR recovery.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LATEST METRICS GRID */}
      <div>
        <h2 className="font-mono text-xs text-muted-foreground mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-white inline-block"></span>
          TODAY'S BIO-METRICS
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <MetricStatus label="Sleep" value={rawValues.sleep.toFixed(1)} unit="h" flag={processedState.sleep} />
          <MetricStatus label="RHR" value={Math.round(rawValues.rhr)} unit="bpm" flag={processedState.rhr} />
          <MetricStatus label="HRV" value={Math.round(rawValues.hrv)} unit="ms" flag={processedState.hrv} />
          
          <MetricStatus label="Protein" value={rawValues.protein} unit="g" flag={processedState.protein} />
          <MetricStatus label="Gut" value={rawValues.gut} unit="/5" flag={processedState.gut} />
          <MetricStatus label="Symp" value={rawValues.symptomScore} unit="/5" flag={processedState.symptomScore} />
        </div>
      </div>

      {/* TRACEBACK HEATMAP */}
      <div className="pt-2">
        <h2 className="font-mono text-xs text-muted-foreground mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-white inline-block"></span>
          14-DAY TRACEBACK MATRIX
        </h2>
        
        {/* Matrix Header */}
        <div className="grid grid-cols-[auto_1fr] gap-2">
           {/* Row Labels */}
           <div className="flex flex-col justify-between py-1 text-[9px] font-mono text-muted-foreground text-right pr-2 gap-1">
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
           <div className="grid grid-cols-14 gap-[2px]">
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
        
        <div className="flex justify-end gap-4 mt-2">
           <div className="flex items-center gap-1">
             <div className="w-2 h-2 bg-flag-green"></div>
             <span className="text-[9px] font-mono text-muted-foreground">OPTIMAL</span>
           </div>
           <div className="flex items-center gap-1">
             <div className="w-2 h-2 bg-flag-yellow"></div>
             <span className="text-[9px] font-mono text-muted-foreground">DEV</span>
           </div>
           <div className="flex items-center gap-1">
             <div className="w-2 h-2 bg-flag-red"></div>
             <span className="text-[9px] font-mono text-muted-foreground">CRIT</span>
           </div>
        </div>
      </div>

    </div>
  );
}
