"use client";
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const PHASES = [
  { icon: "🔍", text: "Reading text…" },
  { icon: "🏷️", text: "Identifying item…" },
  { icon: "📚", text: "Checking historical context…" },
  { icon: "💰", text: "Estimating value…" },
  { icon: "🔎", text: "Finding comparable sales…" },
  { icon: "✨", text: "Finalizing research record…" },
];

export function ProcessingPhaseIndicator({ isActive }: { isActive: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % PHASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-3 py-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-2"
        >
          <span className="text-lg">{PHASES[phase].icon}</span>
          <span className="text-sm text-[var(--text-200)] font-medium">
            {PHASES[phase].text}
          </span>
        </motion.div>
      </AnimatePresence>
      {/* Progress dots */}
      <div className="flex gap-1 ml-auto">
        {PHASES.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i === phase ? 'bg-[var(--accent-warm)]' : 'bg-[var(--surface-600)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
