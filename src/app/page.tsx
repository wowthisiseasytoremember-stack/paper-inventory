"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BulkUpload } from '@/components/BulkUpload';
import { ItemCard } from '@/components/ItemCard';
import { 
  Search, 
  Archive, 
  ArrowUpDown,
  LayoutGrid,
  List,
  Grid3X3,
  Upload,
  Calendar,
  Tag,
  DollarSign,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Item {
    id: string;
    title?: string;
    status: string;
    createdAt: string;
    thumbnailPath?: string;
    valuation?: string;
    tags?: string[];
    historicalContext?: string;
}

type SortOption = 'newest' | 'oldest' | 'title';
type ViewMode = 'grid' | 'compact' | 'table';

const SkeletonCard = ({ viewMode }: { viewMode: ViewMode }) => (
  <div className={cn(
    "rounded-[6px] bg-[var(--surface-800)] border border-[var(--glass-01)] animate-shimmer",
    viewMode === 'table' ? "h-[64px] w-full" : "flex flex-col min-h-[420px]"
  )}>
    {viewMode !== 'table' && <div className="w-full h-[260px] bg-[var(--surface-780)]" />}
    <div className="flex-1 p-[16px]">
        <div className="w-2/3 h-4 rounded bg-[var(--surface-780)] mb-2" />
        <div className="w-1/2 h-4 rounded bg-[var(--surface-780)]" />
    </div>
  </div>
);

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const fetchItems = useCallback(async () => {
    try {
      const url = query ? `/api/items?q=${encodeURIComponent(query)}` : '/api/items';
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const hasProcessing = items.some(i => !['complete', 'error'].includes(i.status));
    const interval = setInterval(fetchItems, hasProcessing ? 3000 : 20000);
    return () => clearInterval(interval);
  }, [fetchItems, items]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      return 0;
    });
  }, [items, sortBy]);

  return (
    <main className="min-h-screen bg-[var(--bg-900)] text-[var(--text-100)] pb-[64px]">
      
      {/* A2 — Top bar */}
      <header className="w-full h-[64px] flex items-center justify-between px-[16px] sticky top-0 z-40 bg-[var(--bg-900)]/90 backdrop-blur-xl border-b border-[var(--glass-01)] mb-[40px]">
          
          {/* Left: Search field */}
          <div className="relative w-full max-w-[380px]">
            <Search className="absolute left-[16px] top-1/2 -translate-y-1/2 text-[var(--text-200)] w-4 h-4" />
            <input 
                type="text" 
                placeholder="Search inventory..." 
                className="w-full pl-[40px] pr-[16px] h-[40px] rounded-[8px] bg-[var(--surface-800)] text-[var(--text-100)] placeholder-[var(--text-300)] focus:ring-1 focus:ring-[var(--accent-warm)] border border-[var(--glass-01)] hover:border-[var(--glass-02)] outline-none transition-luxury text-[13px]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Center: View Switcher */}
          <div className="flex items-center bg-[var(--surface-800)] p-1 rounded-[8px] border border-[var(--glass-01)] gap-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-[6px] transition-all",
                viewMode === 'grid' ? "bg-[var(--surface-780)] text-[var(--accent-warm)] shadow-sm" : "text-[var(--text-300)] hover:text-[var(--text-100)]"
              )}
              title="Standard Grid"
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('compact')}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-[6px] transition-all",
                viewMode === 'compact' ? "bg-[var(--surface-780)] text-[var(--accent-warm)] shadow-sm" : "text-[var(--text-300)] hover:text-[var(--text-100)]"
              )}
              title="Compact Grid"
            >
              <Grid3X3 size={16} />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-[6px] transition-all",
                viewMode === 'table' ? "bg-[var(--surface-780)] text-[var(--accent-warm)] shadow-sm" : "text-[var(--text-300)] hover:text-[var(--text-100)]"
              )}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>

          {/* Right: Sort + Upload */}
          <div className="flex items-center gap-3">
             <div className="relative">
                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none bg-[var(--surface-800)] h-[40px] border border-[var(--glass-01)] text-[var(--text-100)] text-[13px] font-medium rounded-[8px] px-3 pr-[32px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-warm)] cursor-pointer hover:bg-[var(--surface-780)] transition-luxury"
                >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="title">A-Z</option>
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-300)] w-[14px] h-[14px] pointer-events-none" />
             </div>

             <button 
               onClick={() => setShowUpload(!showUpload)}
               className="h-[40px] px-4 rounded-[8px] bg-transparent border border-[var(--accent-warm)] text-[var(--accent-warm)] text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[var(--accent-warm)]/5 transition-luxury hover-lift ml-1"
             >
                <Upload size={14} />
                <span>Bulk Upload</span>
             </button>
          </div>
      </header>
        
      {/* Upload Drawer */}
      <AnimatePresence>
        {showUpload && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-[16px] mb-[40px] max-w-[1248px] mx-auto"
          >
              <div className="bg-[var(--surface-800)] rounded-[12px] border border-[var(--glass-02)] p-6 satin-shadow">
                <BulkUpload />
              </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* A3 — Grid / Table Container */}
      <section className="px-[16px] w-full max-w-[1280px] mx-auto">
          {loading ? (
             <div className={cn(
               "grid gap-[24px]",
               viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : 
               viewMode === 'compact' ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1"
             )}>
               {[...Array(6)].map((_, i) => <SkeletonCard key={i} viewMode={viewMode} />)}
             </div>
          ) : items.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-32 text-center rounded-[12px] border border-dashed border-[var(--glass-02)] bg-[var(--surface-800)]/30 max-w-[600px] mx-auto">
                 <Archive className="w-12 h-12 text-[var(--text-300)] mb-4 opacity-50" />
                 <h3 className="text-[18px] text-[var(--text-100)] mb-2 font-serif font-bold">No Items Found</h3>
                 <p className="text-[14px] text-[var(--text-300)] mb-8 max-w-[300px]">Start by uploading document sequences for AI analysis.</p>
                 <button
                   onClick={() => setShowUpload(true)}
                   className="px-8 py-3 bg-[var(--accent-warm)] text-[#0A0A0B] text-[14px] font-bold rounded-[8px] hover-lift transition-all"
                 >
                   Begin Identification
                 </button>
             </div>
          ) : (
             <>
               {viewMode === 'table' ? (
                 <div className="bg-[var(--surface-800)] rounded-[8px] border border-[var(--glass-01)] overflow-hidden satin-shadow">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="border-b border-[var(--glass-01)] bg-[var(--surface-780)]/50">
                         <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-300)] uppercase tracking-widest">Document</th>
                         <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-300)] uppercase tracking-widest">Status</th>
                         <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-300)] uppercase tracking-widest">Price</th>
                         <th className="px-6 py-4 text-[10px] font-bold text-[var(--text-300)] uppercase tracking-widest text-right">Added</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-[var(--glass-01)]">
                       {sortedItems.map((item) => (
                         <tr key={item.id} className="hover:bg-[var(--glass-01)] transition-colors group cursor-pointer" onClick={() => window.location.href = `/items/${item.id}`}>
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-4">
                               {item.thumbnailPath ? (
                                 <img src={`/api/items/${item.id}/thumbnail`} alt="" className="w-10 h-10 object-cover rounded-[4px] border border-[var(--glass-01)]" />
                               ) : (
                                 <div className="w-10 h-10 bg-[var(--surface-780)] rounded-[4px] flex items-center justify-center"><FileText size={16} className="text-[var(--text-300)]" /></div>
                               )}
                               <span className="text-[14px] font-medium text-[var(--text-100)] group-hover:text-[var(--accent-warm)] transition-colors line-clamp-1">{item.title || 'Identification in progress...'}</span>
                             </div>
                           </td>
                           <td className="px-6 py-4">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[4px]",
                                item.status === 'complete' ? "text-[var(--accent-warm)] bg-[var(--accent-warm)]/10" : 
                                item.status === 'error' ? "text-[var(--status-review)] bg-[var(--status-review)]/10" : 
                                "text-[var(--status-processing)] bg-[var(--status-processing)]/10"
                              )}>
                                {item.status.replace('_', ' ')}
                              </span>
                           </td>
                           <td className="px-6 py-4">
                             <span className="text-[14px] font-serif text-[var(--accent-warm)] font-bold">{item.valuation || '—'}</span>
                           </td>
                           <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-2 text-[12px] text-[var(--text-300)]">
                                <Calendar size={12} />
                                {new Date(item.createdAt).toLocaleDateString()}
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               ) : (
                 <div className={cn(
                   "grid gap-[24px] items-start",
                   viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                 )}>
                    {sortedItems.map((item, idx) => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                        className={cn(viewMode === 'grid' ? "" : "scale-90 origin-top")}
                      >
                        <ItemCard item={item} />
                      </motion.div>
                    ))}
                 </div>
               )}
             </>
          )}
      </section>

    </main>
  );
}
