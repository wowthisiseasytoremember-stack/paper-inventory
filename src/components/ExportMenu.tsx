"use client";
import { Download } from 'lucide-react';
import { useState } from 'react';

export function ExportMenu() {
  const [open, setOpen] = useState(false);

  const download = (format: 'csv' | 'json', decision?: string) => {
    const params = new URLSearchParams({ format });
    if (decision) params.set('decision', decision);
    window.location.href = `/api/export?${params.toString()}`;
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-[var(--surface-780)] border border-[var(--glass-01)] text-sm text-[var(--text-200)] hover:border-[var(--glass-02)] transition-colors"
      >
        <Download size={14} />
        Export
      </button>
      {open && (
        <div 
          className="absolute right-0 top-full mt-1 bg-[var(--surface-800)] border border-[var(--glass-01)] rounded-[6px] shadow-lg z-20 min-w-[180px] py-1"
          onMouseLeave={() => setOpen(false)}
        >
          {[
            { label: 'All research (CSV)', action: () => download('csv') },
            { label: 'All research (JSON)', action: () => download('json') },
            { label: 'Interested only (CSV)', action: () => download('csv', 'interested') },
            { label: 'Purchased only (CSV)', action: () => download('csv', 'purchased') },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full text-left px-4 py-2 text-sm text-[var(--text-200)] hover:bg-[var(--surface-780)] hover:text-[var(--text-100)] transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
