import React, { useEffect, useState } from 'react';
import type { DailyLog } from '@shared/schema';
import { RotateCcw } from 'lucide-react';

type Flag = 'GREEN' | 'YELLOW' | 'RED';

const HeatmapCell = ({ flag }: { flag: Flag }) => {
  const color = 
    flag === 'RED' ? 'bg-flag-red' :        // Critical state - red background
    flag === 'YELLOW' ? 'bg-flag-yellow' :  // Warning state - yellow background
    'bg-flag-green';                        // Optimal state - green background (default)
    
  return <div className={`w-full aspect-square ${color} rounded-md opacity-90 hover:opacity-100 transition-opacity shadow-[0_6px_18px_-10px_rgba(0,0,0,0.45)]`} />;
};

interface HeatmapProps {
  logs: DailyLog[];  // Array of daily health log entries
  flipped?: boolean; // External flip state from Dashboard
}

export default function Heatmap({ logs, flipped = false }: HeatmapProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduceMotion(Boolean(mql.matches));
    onChange();
    try {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } catch {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);

  const front = (
    <div className="relative z-10 space-y-4">
      <div className="space-y-2">
        {[{ label: 'SLP', flag: 'sleepFlag' }, { label: 'RHR', flag: 'rhrFlag' }, { label: 'HRV', flag: 'hrvFlag' }, { label: 'PRO', flag: 'proteinFlag' }, { label: 'GUT', flag: 'gutFlag' }, { label: 'SUN', flag: 'sunFlag' }, { label: 'EXE', flag: 'exerciseFlag' }, { label: 'SYM', flag: 'symptomFlag' }].map(({ label, flag }) => (
          <div key={label} className="grid grid-cols-[60px_1fr] gap-3 items-center">
            <div className="text-[11px] font-semibold text-slate-200/80 tracking-wide text-right pr-1">{label}</div>
            <div className="grid grid-cols-14 gap-1.5">
              {logs.slice(-14).map((log, i) => (
                <HeatmapCell key={i} flag={(log as any)[flag] || 'GREEN'} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-4 mt-2">
        {[
          { label: 'Optimal', color: 'bg-flag-green' },
          { label: 'Deviation', color: 'bg-flag-yellow' },
          { label: 'Critical', color: 'bg-flag-red' }
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200/80">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const back = (
    <div className="h-full min-h-[320px] sm:min-h-[380px] rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6 overflow-auto relative z-10">
      <div className="mono-section-label mb-3 text-cyan-200/80">How to read this</div>
      <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
        <div>Each row is a metric across the last 14 days. Columns progress from oldest (left) to newest (right).</div>
        <div className="text-[13px] text-slate-200/90">
          <span className="font-semibold text-white">Acronyms:</span> SLP (Sleep), RHR (Resting HR), HRV (Heart Rate Variability), PRO (Protein), GUT (Gut), SUN (Sun), EXE (Exercise), SYM (Symptoms).
        </div>
        <div><span className="font-semibold text-white">Green</span> is on-track, <span className="font-semibold text-white">Yellow</span> is a deviation, and <span className="font-semibold text-white">Red</span> is a critical miss.</div>
        <div>Scan for clusters of yellow/red preceding symptom spikes — that is your “traceback.”</div>
        <div className="text-xs text-slate-300/80">Tip: align clusters here with the Recovery vs Symptoms chart to act early.</div>
      </div>
    </div>
  );

  return (
    <div
      className="relative select-none rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/85 via-slate-900/75 to-slate-900/60 p-6 sm:p-8 lg:p-10 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.85)] overflow-hidden"
    >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_18%,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_82%_10%,rgba(232,121,249,0.12),transparent_34%)]" />
        {reduceMotion ? (
          <div onClick={(e) => e.stopPropagation()}>{flipped ? back : front}</div>
        ) : (
          <div className="[perspective:1000px]">
            <div
              className={`relative w-full min-h-[360px] sm:min-h-[420px] transition-transform motion-reduce:transition-none duration-500 [transform-style:preserve-3d] ${
                flipped ? '[transform:rotateY(180deg)]' : ''
              }`}
            >
              <div className="[backface-visibility:hidden]" onClick={(e) => e.stopPropagation()}>{front}</div>
              <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]" onClick={(e) => e.stopPropagation()}>{back}</div>
            </div>
          </div>
        )}
    </div>
  );
}