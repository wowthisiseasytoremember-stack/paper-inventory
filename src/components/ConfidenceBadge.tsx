import { cn } from '@/lib/utils';

interface Props {
  confidence: number | null; // 0.0 - 1.0
  showLabel?: boolean;
}

export function ConfidenceBadge({ confidence, showLabel = false }: Props) {
  if (confidence === null || confidence === undefined) return null;

  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  const textColor = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-1.5">
      {/* Mini bar */}
      <div className="w-10 h-1 bg-[var(--surface-600)] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className={cn("text-[10px] font-medium", textColor)}>{pct}%</span>
      )}
    </div>
  );
}
