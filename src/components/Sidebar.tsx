import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Layers3, 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  Database, 
  History,
  Trash2,
  Sparkles,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Archival Log', href: '/log', icon: History },
  { name: 'Collections', href: '/collections', icon: Database },
  { name: 'Search', href: '/search', icon: Search },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to wipe the entire vault? This will delete ALL items and images permanently.')) return;
    
    const toastId = toast.loading('Wiping vault...');
    try {
      const res = await fetch('/api/admin/clear', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      toast.success('Vault wiped successfully', { id: toastId });
      window.location.href = '/';
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <div className="flex flex-col h-full w-64 bg-slate-950 border-r border-slate-900 glass backdrop-blur-3xl shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <Layers3 size={24} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter leading-none mb-1">Vault</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] flex items-center gap-1">
              <Sparkles size={10} className="text-blue-500" /> Pro 2.0
            </p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-luxury group",
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/10 shadow-lg shadow-blue-500/5" 
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                )}
              >
                <item.icon size={18} className={cn("transition-transform group-hover:scale-110", isActive && "text-blue-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 space-y-4">
        <div className="pt-4 border-t border-slate-900">
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-sm font-bold text-red-500/70 hover:text-red-400 hover:bg-red-500/5 transition-luxury group border border-transparent"
          >
            <Trash2 size={18} className="group-hover:rotate-12 transition-transform" />
            Clear History
          </button>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-luxury group border border-transparent"
          >
            <Settings size={18} className="group-hover:rotate-45 transition-transform" />
            Settings
          </Link>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Archive Size</span>
            <span className="text-[9px] font-black text-blue-500 uppercase">Premium</span>
          </div>
          <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div className="h-full bg-blue-600 w-1/3 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
