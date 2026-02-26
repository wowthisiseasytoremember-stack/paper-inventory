"use client";
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValueConfidence } from '@/types/research';

interface Props {
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_point: number | null;
  value_confidence: ValueConfidence | null;
  is_high_value: boolean;
  ebay_keywords: string | null;
  compact?: boolean; // true for card, false for detail page
}

const confidenceColors: Record<ValueConfidence, string> = {
  high: 'text-green-400',
  medium: 'text-yellow-400',
  low: 'text-[var(--text-400)]',
};

export function ValuationBlock({
  estimated_value_low, estimated_value_high, estimated_value_point,
  value_confidence, is_high_value, ebay_keywords, compact = false
}: Props) {
  const hasValue = estimated_value_point !== null || estimated_value_low !== null;

  if (!hasValue) {
    return <p className="text-sm text-[var(--text-400)] italic">Valuation pending…</p>;
  }

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const displayRange = estimated_value_low !== null && estimated_value_high !== null
    ? `${fmt(estimated_value_low)} – ${fmt(estimated_value_high)}`
    : null;

  const displayPoint = estimated_value_point !== null ? fmt(estimated_value_point) : null;

  const ebayUrl = ebay_keywords
    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebay_keywords)}&LH_Sold=1&LH_Complete=1`
    : null;

  if (compact) {
    return (
      <div className="flex items-baseline gap-2 mt-4">
        <span className={cn("text-[18px] font-bold font-serif tracking-tight", is_high_value ? "text-[var(--accent-warm)]" : "text-[var(--text-100)]")}>
          {displayPoint || displayRange}
        </span>
        {value_confidence && (
          <span className={cn("text-[10px] font-medium uppercase", confidenceColors[value_confidence])}>
            {value_confidence}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3 flex-wrap">
        {displayPoint && (
          <span className={cn("text-3xl font-bold font-serif tracking-tight", is_high_value ? "text-[var(--accent-warm)]" : "text-[var(--text-100)]")}>
            {displayPoint}
          </span>
        )}
        {displayRange && (
          <span className="text-lg text-[var(--text-200)]">{displayRange}</span>
        )}
        {is_high_value && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-warm)]/20 text-[var(--accent-warm)] border border-[var(--accent-warm)]/30">
            HIGH VALUE
          </span>
        )}
      </div>

      {value_confidence && (
        <p className={cn("text-xs font-medium", confidenceColors[value_confidence])}>
          {value_confidence.charAt(0).toUpperCase() + value_confidence.slice(1)} confidence
        </p>
      )}

      {ebayUrl && (
        <a
          href={ebayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-300)] hover:text-[var(--accent-warm)] transition-colors"
        >
          <ExternalLink size={11} />
          Search sold listings: {ebay_keywords}
        </a>
      )}
    </div>
  );
}
