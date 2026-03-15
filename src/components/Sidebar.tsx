"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Layers3, 
  LayoutDashboard, 
  Database, 
  Trash2,
  Sparkles,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const navItems = [
  { name: 'Vault Inventory', href: '/', icon: LayoutDashboard },
  { name: 'Sequences', href: '/collections', icon: Database },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  const handleClearHistory = async () => {
    if (!confirm('PURGE ENTIRE VAULT? This will permanently delete all records and assets.')) return;
    
    const toastId = toast.loading('Purging vault...');
    try {
      const res = await fetch('/api/admin/clear', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'System reset failed');
      toast.success('Vault purged', { id: toastId });
      window.location.href = '/';
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-slate-900/50 backdrop-blur-xl text-slate-400", className)}>
      <div className="p-6 pt-10 space-y-10">
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-2xl">
            <Layers3 size={18} className="text-slate-950" strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-widest uppercase">Archive</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">Pro Ingest 2.0</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] px-3 mb-3">Core Units</p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 h-10 px-3 rounded-lg text-xs font-bold transition-all group",
                  isActive 
                    ? "bg-white/10 text-white shadow-sm" 
                    : "hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <item.icon size={14} className={cn("transition-transform group-hover:scale-110", isActive ? "text-blue-500" : "text-slate-600")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Action Area */}
        <div className="pt-4 px-2">
            <Link 
            href="/?upload=true"
            className="w-full h-10 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/10"
            >
            <Upload size={14} />
            <span>New Ingest</span>
            </Link>
        </div>
      </div>

      <div className="mt-auto p-6 space-y-4">
        <div className="pt-4 border-t border-white/5">
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-3 h-10 px-3 w-full rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 hover:bg-red-400/5 transition-all group"
          >
            <Trash2 size={14} className="text-slate-700 group-hover:text-red-500 group-hover:rotate-12 transition-all" />
            System Reset
          </button>
        </div>
      </div>
    </div>
  );
}
