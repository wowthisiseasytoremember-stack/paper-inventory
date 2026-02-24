import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Layers3, 
  LayoutDashboard, 
  Database, 
  History,
  Trash2,
  Sparkles,
  Search,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const navItems = [
  { name: 'Inventory', href: '/', icon: LayoutDashboard },
  { name: 'Collections', href: '/collections', icon: Database },
];

export function Sidebar({ className }: { className?: string }) {
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
    <div className={cn("flex flex-col h-full bg-[var(--surface-800)] text-[var(--text-100)]", className)}>
      <div className="p-[24px] pt-[32px]">
        {/* Logo Area */}
        <div className="flex items-center gap-3 mb-[24px] h-[40px]">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-780)] border border-[var(--glass-01)] flex items-center justify-center shadow-lg">
            <Layers3 size={24} className="text-[var(--accent-warm)]" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none mb-1 font-serif">Vault</h1>
            <p className="text-[10px] text-[var(--accent-cool)] font-medium uppercase tracking-[0.2em] flex items-center gap-1">
              <Sparkles size={10} className="text-[var(--accent-warm)]" /> Pro 2.0
            </p>
          </div>
        </div>

        {/* Collections List placeholder / Nav */}
        <nav className="space-y-[12px]">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 h-[52px] px-4 rounded-[6px] text-[14px] font-medium transition-all group",
                  isActive 
                    ? "bg-[var(--surface-780)] text-[var(--text-100)] border-l-[3px] border-[var(--accent-warm)] shadow-sm" 
                    : "text-[var(--text-200)] hover:text-[var(--text-100)] hover:bg-[var(--glass-01)] border-l-[3px] border-transparent"
                )}
              >
                <item.icon size={18} className={cn("transition-transform group-hover:scale-105", isActive ? "text-[var(--accent-warm)]" : "text-[var(--accent-cool)]")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Upload CTA */}
        <Link 
          href="/?upload=true"
          className="mt-[24px] w-full h-[48px] rounded-[8px] bg-transparent border border-[var(--accent-warm)] text-[var(--accent-warm)] text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[var(--glass-01)] transition-luxury hover-lift"
        >
          <Upload size={18} />
          <span>Upload Items</span>
        </Link>
      </div>

      <div className="mt-auto p-[24px] pb-[32px] space-y-4">
        <div className="pt-4 border-t border-[var(--surface-780)]">
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-3 h-[48px] px-4 w-full rounded-[6px] text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-luxury group border border-transparent"
          >
            <Trash2 size={18} className="text-red-400/70 group-hover:rotate-12 transition-transform" />
            Clear History
          </button>
        </div>
      </div>
    </div>
  );
}
