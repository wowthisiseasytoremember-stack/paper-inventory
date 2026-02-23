"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { BulkUpload } from '@/components/BulkUpload';
import { ItemCard } from '@/components/ItemCard';
import { 
  Search, 
  Archive, 
  ArrowUpDown,
  Filter,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Item {
    id: string;
    title?: string;
    status: string;
    createdAt: string;
    thumbnailPath?: string;
    valuation?: string;
    tags?: string;
    historicalContext?: string;
}

type SortOption = 'newest' | 'oldest' | 'title';

const SkeletonCard = () => (
  <div className="rounded-[6px] bg-[var(--surface-800)] border border-[var(--glass-01)] flex flex-col min-h-[420px]">
    <div className="w-full h-[260px] bg-[var(--surface-780)] animate-shimmer" />
    <div className="flex-1 p-[16px]">
        <div className="w-2/3 h-4 rounded bg-[var(--surface-780)] animate-shimmer mb-2" />
        <div className="w-1/2 h-4 rounded bg-[var(--surface-780)] animate-shimmer" />
    </div>
  </div>
);

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

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
          <div className="relative w-full max-w-[420px]">
            <Search className="absolute left-[16px] top-1/2 -translate-y-1/2 text-[var(--text-200)] w-4 h-4" />
            <input 
                type="text" 
                placeholder="Search sequence..." 
                className="w-full pl-[40px] pr-[16px] h-[44px] rounded-[8px] bg-[var(--surface-800)] text-[var(--text-100)] placeholder-[var(--text-300)] focus:ring-1 focus:ring-[var(--accent-warm)] border border-[var(--glass-01)] hover:border-[var(--glass-02)] outline-none transition-luxury text-[14px]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Right: Sort + Filter + Upload */}
          <div className="flex items-center gap-3">
             <div className="relative">
                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none bg-[var(--surface-800)] h-[44px] border border-[var(--glass-01)] text-[var(--text-100)] text-[14px] font-medium rounded-[8px] px-4 pr-[32px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-warm)] cursor-pointer hover:bg-[var(--surface-780)] transition-luxury"
                >
                    <option value="newest">Recent</option>
                    <option value="oldest">Legacy</option>
                    <option value="title">A-Z</option>
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-300)] w-[14px] h-[14px] pointer-events-none" />
             </div>

             <button className="w-[44px] h-[44px] flex items-center justify-center rounded-[8px] border border-[var(--glass-01)] bg-[var(--surface-800)] text-[var(--text-100)] hover:bg-[var(--surface-780)] transition-luxury">
                <Filter size={16} />
             </button>

             <button 
               onClick={() => setShowUpload(!showUpload)}
               className="h-[48px] px-6 rounded-[8px] bg-transparent border border-[var(--accent-warm)] text-[var(--accent-warm)] text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[var(--glass-01)] transition-luxury hover-lift ml-2"
             >
                <Upload size={16} />
                <span>Bulk Upload</span>
             </button>
          </div>
      </header>
        
      {/* Upload Drawer / Space */}
      <AnimatePresence>
        {showUpload && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-[16px] mb-[40px] max-w-[988px]"
          >
              <div>
                <BulkUpload />
              </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* A3 — Grid Container */}
      <section className="px-[16px] w-full max-w-[1020px]">
          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px]">
               {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
             </div>
          ) : items.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-32 text-center rounded-[12px] border border-dashed border-[var(--glass-02)] bg-[var(--surface-800)]/30">
                 <Archive className="w-8 h-8 text-[var(--text-300)] mb-4 opacity-50" />
                 <h3 className="text-[14px] text-[var(--text-200)] mb-6 font-medium">Archive Empty</h3>
                 <button
                   onClick={() => setShowUpload(true)}
                   className="px-6 py-2 bg-[var(--accent-warm)] text-[#0A0A0B] text-[14px] font-bold rounded-[8px] hover:scale-105 transition-transform"
                 >
                   Initialize Uploads
                 </button>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px] place-items-center sm:place-items-stretch">
                {sortedItems.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                  >
                    <ItemCard item={item} />
                  </motion.div>
                ))}
             </div>
          )}
      </section>

    </main>
  );
}
