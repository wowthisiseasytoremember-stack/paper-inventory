"use client";

import { cn } from '@/lib/utils';

interface Props {
  total: number;
  complete: number;
  high_value: number;
  interested: number;
  total_value: number | null;
}

export function StatsBar({ total, complete, high_value, interested, total_value }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-12 gap-y-6 px-8 py-6">
      <Stat label="Total Researched" value={total} />
      <Stat label="Fully Identified" value={complete} />
      <Stat label="High Value Units" value={high_value} highlight />
      <Stat label="Interested" value={interested} />
      {total_value !== null && (
        <Stat label="Est. Portfolio Value" value={`$${total_value.toLocaleString()}`} highlight />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</div>
      <div className={cn(
        "text-2xl font-black tracking-tighter tabular-nums leading-none",
        highlight ? "text-emerald-500" : "text-white"
      )}>
        {value}
      </div>
    </div>
  );
}
