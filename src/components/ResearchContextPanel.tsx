"use client";
import { useState } from 'react';
import { MapPin, DollarSign, StickyNote, CheckCircle, XCircle, Star, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PurchaseDecision } from '@/types/research';
import { toast } from 'sonner';

const DECISIONS: { value: PurchaseDecision; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'interested', label: 'Interested', icon: <Star size={14} />, color: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' },
  { value: 'purchased', label: 'Purchased', icon: <CheckCircle size={14} />, color: 'text-green-400 border-green-400/40 bg-green-400/10' },
  { value: 'passed', label: 'Passed', icon: <XCircle size={14} />, color: 'text-red-400 border-red-400/40 bg-red-400/10' },
  { value: 'undecided', label: 'Undecided', icon: <HelpCircle size={14} />, color: 'text-[var(--text-300)] border-[var(--glass-01)] bg-transparent' },
];

interface Props {
  itemId: string;
  initial: {
    research_location: string | null;
    asking_price: string | null;
    purchase_decision: PurchaseDecision;
    research_notes: string | null;
  };
}

export function ResearchContextPanel({ itemId, initial }: Props) {
  const [location, setLocation] = useState(initial.research_location || '');
  const [askingPrice, setAskingPrice] = useState(initial.asking_price || '');
  const [decision, setDecision] = useState<PurchaseDecision>(initial.purchase_decision);
  const [notes, setNotes] = useState(initial.research_notes || '');
  const [saving, setSaving] = useState(false);

  async function save(patch: Record<string, string>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/items/${itemId}/research`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success("Saved");
    } catch (e) {
      toast.error("Error saving research context.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-200)] uppercase tracking-wider">Research Context</h3>

      {/* Purchase Decision */}
      <div>
        <label className="text-xs text-[var(--text-300)] mb-2 block">Decision</label>
        <div className="flex flex-wrap gap-2">
          {DECISIONS.map(d => (
            <button
              key={d.value}
              onClick={() => { setDecision(d.value); save({ purchase_decision: d.value }); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                decision === d.value ? d.color : "text-[var(--text-300)] border-[var(--glass-01)] hover:border-[var(--glass-02)]"
              )}
            >
              {d.icon}{d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Where Found */}
      <div>
        <label className="text-xs text-[var(--text-300)] mb-1 flex items-center gap-1">
          <MapPin size={11} /> Where Found
        </label>
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          onBlur={() => save({ research_location: location })}
          placeholder="e.g. Rose Bowl Flea Market, Booth 42"
          className="w-full bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-100)] placeholder:text-[var(--text-400)] focus:outline-none focus:border-[var(--accent-warm)]/50"
        />
      </div>

      {/* Asking Price */}
      <div>
        <label className="text-xs text-[var(--text-300)] mb-1 flex items-center gap-1">
          <DollarSign size={11} /> Asking Price
        </label>
        <input
          value={askingPrice}
          onChange={e => setAskingPrice(e.target.value)}
          onBlur={() => save({ asking_price: askingPrice })}
          placeholder='e.g. "$40", "Make offer", "Free bin"'
          className="w-full bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-100)] placeholder:text-[var(--text-400)] focus:outline-none focus:border-[var(--accent-warm)]/50"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-[var(--text-300)] mb-1 flex items-center gap-1">
          <StickyNote size={11} /> Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => save({ research_notes: notes })}
          placeholder="Condition observations, seller info, gut feelings…"
          rows={3}
          className="w-full bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-100)] placeholder:text-[var(--text-400)] focus:outline-none focus:border-[var(--accent-warm)]/50 resize-none"
        />
      </div>

      {saving && <p className="text-xs text-[var(--text-400)]">Saving…</p>}
    </div>
  );
}
