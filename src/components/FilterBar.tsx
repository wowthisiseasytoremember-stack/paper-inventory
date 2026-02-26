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
  categories: string[]; // available categories from current items
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

  const chipClass = (active: boolean, color?: string) => cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none",
    active
      ? color || "bg-[var(--accent-warm)]/20 border-[var(--accent-warm)]/40 text-[var(--accent-warm)]"
      : "bg-transparent border-[var(--glass-01)] text-[var(--text-300)] hover:border-[var(--glass-02)] hover:text-[var(--text-200)]"
  );

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        className={chipClass(filters.high_value, "bg-yellow-400/10 border-yellow-400/40 text-yellow-400")}
        onClick={() => toggle('high_value', !filters.high_value)}
      >
        <Gem size={11} /> High Value {counts.high_value > 0 && `(${counts.high_value})`}
      </button>

      <button
        className={chipClass(filters.decision === 'interested')}
        onClick={() => toggle('decision', 'interested')}
      >
        <Star size={11} /> Interested {counts.interested > 0 && `(${counts.interested})`}
      </button>

      <button
        className={chipClass(filters.decision === 'purchased', "bg-green-400/10 border-green-400/40 text-green-400")}
        onClick={() => toggle('decision', 'purchased')}
      >
        <CheckCircle size={11} /> Purchased {counts.purchased > 0 && `(${counts.purchased})`}
      </button>

      <button
        className={chipClass(filters.decision === 'passed', "bg-red-400/10 border-red-400/40 text-red-400")}
        onClick={() => toggle('decision', 'passed')}
      >
        <XCircle size={11} /> Passed {counts.passed > 0 && `(${counts.passed})`}
      </button>

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
          className="text-xs text-[var(--text-400)] hover:text-[var(--text-200)] underline"
          onClick={() => onChange({ decision: null, high_value: false, category: null })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
