interface Props {
  total: number;
  complete: number;
  high_value: number;
  interested: number;
  total_value: number | null;
}

export function StatsBar({ total, complete, high_value, interested, total_value }: Props) {
  return (
    <div className="flex flex-wrap gap-6 text-sm">
      <Stat label="Researched" value={total} />
      <Stat label="Identified" value={complete} />
      <Stat label="High Value" value={high_value} highlight />
      <Stat label="Interested" value={interested} />
      {total_value !== null && (
        <Stat label="Est. Total Value" value={`$${total_value.toLocaleString()}`} highlight />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <div className={highlight ? "text-[var(--accent-warm)] font-bold text-lg" : "text-[var(--text-100)] font-semibold text-lg"}>
        {value}
      </div>
      <div className="text-[var(--text-400)] text-xs uppercase tracking-wider">{label}</div>
    </div>
  );
}
