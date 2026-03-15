"use client";
import { cn } from '@/lib/utils';
import { Star, CheckCircle, XCircle, Gem } from 'lucide-react';

export interface FilterState {
  decision: string | null;
  high_value: boolean;
  category: string | null;
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  categories: string[]; 
  counts: {
    interested: number;
    purchased: number;
    passed: number;
    high_value: number;
  };
}

export function FilterBar({ filters, onChange, categories, counts }: Props) {
  const toggle = (key: keyof FilterState, value: string | boolean | null) => {
    const current = filters[key as keyof FilterState];
    onChange({ ...filters, [key]: current === value ? null : value });
  };

  const chipClass = (active: boolean, activeColor?: string) => cn(
    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer select-none active:scale-95",
    active
      ? activeColor || "bg-white text-slate-950 border-white shadow-lg"
      : "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10 hover:border-white/10"
  );

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        className={chipClass(filters.high_value, "bg-yellow-400 text-slate-950 border-yellow-400")}
        onClick={() => toggle('high_value', !filters.high_value)}
      >
        <Gem size={12} /> High Value {counts.high_value > 0 && `(${counts.high_value})`}
      </button>

      <div className="w-[1px] h-4 bg-white/10 mx-1" />

      <button
        className={chipClass(filters.decision === 'interested', "bg-amber-500 text-slate-950 border-amber-500")}
        onClick={() => toggle('decision', 'interested')}
      >
        <Star size={12} /> Interested {counts.interested > 0 && `(${counts.interested})`}
      </button>

      <button
        className={chipClass(filters.decision === 'purchased', "bg-emerald-500 text-slate-950 border-emerald-500")}
        onClick={() => toggle('decision', 'purchased')}
      >
        <CheckCircle size={12} /> Purchased {counts.purchased > 0 && `(${counts.purchased})`}
      </button>

      <button
        className={chipClass(filters.decision === 'passed', "bg-red-500 text-slate-950 border-red-500")}
        onClick={() => toggle('decision', 'passed')}
      >
        <XCircle size={12} /> Passed {counts.passed > 0 && `(${counts.passed})`}
      </button>

      {categories.length > 0 && <div className="w-[1px] h-4 bg-white/10 mx-1" />}

      {/* Dynamic category chips */}
      {categories.map(cat => (
        <button
          key={cat}
          className={chipClass(filters.category === cat)}
          onClick={() => toggle('category', cat)}
        >
          {cat}
        </button>
      ))}

      {/* Clear all */}
      {(filters.decision || filters.high_value || filters.category) && (
        <button
          className="ml-2 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-white transition-colors"
          onClick={() => onChange({ decision: null, high_value: false, category: null })}
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}
