import React from 'react';

interface FeatureGateProps {
  allowed: boolean;
  label?: string;
  ctaLabel?: string;
  onUpgrade?: () => void;
  children: React.ReactNode;
  headerBadge?: React.ReactNode;
}

export function FeatureGate({ allowed, label = 'Unlock with Pro', ctaLabel = 'Upgrade', onUpgrade, children, headerBadge }: FeatureGateProps) {
  return (
    <div className="relative">
      {headerBadge}
      <div className={allowed ? '' : 'opacity-80 blur-[1px] transition'}>{children}</div>
      {!allowed && (
        <div className="absolute inset-0 rounded-2xl backdrop-blur-md bg-slate-950/60 border border-white/10 flex flex-col items-center justify-center gap-3 text-center p-4 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.8)]">
          <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">Pro</span>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="text-xs text-slate-200/80">Preview locked — upgrade to unlock.</div>
          <button
            type="button"
            onClick={onUpgrade}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-semibold shadow-lg hover:from-emerald-600 hover:to-cyan-600 hover:shadow-emerald-500/25 transition-all"
          >
            {ctaLabel}
          </button>
        </div>
      )}
    </div>
  );
}
