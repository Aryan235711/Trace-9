import React from 'react';

export default function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="w-full rounded-2xl bg-card/30 border border-border/40 p-6 flex items-center justify-center" style={{ height }}>
      <div className="animate-pulse flex flex-col items-center gap-2">
        <div className="w-48 h-5 bg-muted-foreground/20 rounded" />
        <div className="w-96 h-40 bg-muted-foreground/10 rounded-md mt-2" />
        <div className="text-xs text-muted-foreground font-mono mt-2">Loading chart...</div>
      </div>
    </div>
  );
}
