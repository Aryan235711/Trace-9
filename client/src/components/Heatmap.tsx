import React, { useEffect, useState } from 'react';
import type { DailyLog } from '@shared/schema';
import { RotateCcw } from 'lucide-react';

type Flag = 'GREEN' | 'YELLOW' | 'RED';

const HeatmapCell = ({ flag }: { flag: Flag }) => {
  const color = 
    flag === 'RED' ? 'bg-flag-red' :
    flag === 'YELLOW' ? 'bg-flag-yellow' :
    'bg-flag-green';
    
  return <div className={`w-full aspect-square ${color} rounded-sm opacity-90 hover:opacity-100 transition-opacity`} />;
};

interface HeatmapProps {
  logs: DailyLog[];
}

export default function Heatmap({ logs }: HeatmapProps) {
  // Artificial delay to demonstrate lazy loading if needed, or just standard render
  // For a prototype, standard render is fine, the lazy part comes from the import in Dashboard
  
  return (
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
               {logs.slice(-14).map((log, i) => {
                 const flagKey = `${metric}Flag` as keyof typeof log;
                 return (
                   <HeatmapCell 
                    key={i} 
                    flag={(log[flagKey] as Flag) || 'GREEN'} 
                   />
                 );
               })}
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
  );
}
