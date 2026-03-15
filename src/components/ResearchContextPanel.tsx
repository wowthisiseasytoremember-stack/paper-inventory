"use client";
import { useState } from 'react';
import { MapPin, DollarSign, StickyNote, CheckCircle, XCircle, Star, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PurchaseDecision } from '@/types/research';
import { toast } from 'sonner';
import { useItemStore } from '@/store/itemStore';

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
  const updateItemMetadata = useItemStore(state => state.updateItemMetadata);

  async function save(patch: Record<string, any>) {
    setSaving(true);
    try {
      await updateItemMetadata(itemId, patch);
      toast.success("Vault Synchronized");
    } catch (e) {
      console.error("Error saving research context:", e);
      toast.error("Archive sync failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Research Context</h3>

      {/* Purchase Decision */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Status Selection</label>
        <div className="grid grid-cols-2 gap-2">
          {DECISIONS.map(d => (
            <button
              key={d.value}
              onClick={() => { setDecision(d.value); save({ purchase_decision: d.value }); }}
              className={cn(
                "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-bold border transition-all active:scale-[0.98]",
                decision === d.value 
                  ? "bg-slate-100 text-slate-900 border-white shadow-sm" 
                  : "text-slate-500 border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10"
              )}
            >
              {d.icon}{d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs Group */}
      <div className="space-y-5">
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-tight flex items-center gap-1.5">
            <MapPin size={10} /> Discovery Location
            </label>
            <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            onBlur={() => save({ research_location: location })}
            placeholder="e.g. Estate Sale, Pasadena"
            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-colors shadow-inner"
            />
        </div>

        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-tight flex items-center gap-1.5">
            <DollarSign size={10} /> Acquisition Cost
            </label>
            <input
            value={askingPrice}
            onChange={e => setAskingPrice(e.target.value)}
            onBlur={() => save({ asking_price: askingPrice })}
            placeholder='e.g. "$15.00"'
            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-colors shadow-inner"
            />
        </div>

        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-tight flex items-center gap-1.5">
            <StickyNote size={10} /> Archival Notes
            </label>
            <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => save({ research_notes: notes })}
            placeholder="Condition details, provenance..."
            rows={4}
            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-3 text-xs text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 resize-none transition-colors shadow-inner leading-relaxed"
            />
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] animate-pulse">
            <RefreshCw size={10} className="animate-spin" /> Syncing with Vault...
        </div>
      )}
    </div>
  );
}
