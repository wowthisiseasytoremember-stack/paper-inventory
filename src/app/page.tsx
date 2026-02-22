"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { UploadDropzone } from '@/components/UploadDropzone';
import { ItemCard } from '@/components/ItemCard';
import { 
  Loader2, 
  Search, 
  Archive, 
  Plus, 
  LayoutGrid, 
  List, 
  ArrowUpDown,
  Calendar,
  DollarSign,
  Tag,
  Sparkles,
  Filter
} from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Item {
    id: string;
    title?: string;
    status: string;
    createdAt: string;
    thumbnailPath?: string;
    valuation?: string;
    tags?: string; // JSON string
    historicalContext?: string;
}

type SortOption = 'newest' | 'oldest' | 'title';

const SkeletonCard = () => (
  <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-2 overflow-hidden aspect-[4/5]">
    <div className="w-full h-2/3 bg-slate-800 animate-shimmer rounded-xl mb-3" />
    <div className="space-y-2 px-1">
      <div className="h-4 w-3/4 bg-slate-800 animate-shimmer rounded" />
      <div className="h-3 w-1/2 bg-slate-800 animate-shimmer rounded" />
    </div>
  </div>
);

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
    const hasProcessing = items.some(i => !['complete', 'error'].includes(i.status));
    const interval = setInterval(fetchItems, hasProcessing ? 3000 : 20000);
    return () => clearInterval(interval);
  }, [query, fetchItems, items.length]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      return 0;
    });
  }, [items, sortBy]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 selection:bg-blue-500/30">
      {/* Ambient background glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto space-y-8 fade-in">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Vault</h1>
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles size={10} /> Pro 2.0
                  </span>
                </div>
                <p className="text-slate-500 font-medium">Secure intelligence archive for paper ephemera.</p>
            </div>
            
            <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-luxury active:scale-95 shadow-lg shadow-blue-500/20 group relative overflow-hidden",
                    showUpload ? "bg-slate-800 text-slate-300" : "bg-blue-600 text-white hover:bg-blue-500"
                  )}
                >
                  <Plus size={20} className={cn("transition-transform duration-500", showUpload && "rotate-45")} />
                  {showUpload ? "Cancel" : "Add Documents"}
                </button>
            </div>
        </header>
        
        {/* Search & Filters */}
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative group flex-grow">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Search className="text-slate-500 group-focus-within:text-blue-400 transition-colors w-5 h-5" />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search archives by name, tags, or historical context..." 
                        className="w-full pl-12 pr-4 py-4 rounded-3xl border border-slate-800 bg-slate-900/40 text-white placeholder-slate-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-luxury text-sm backdrop-blur-md"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    {/* Sort Dropdown */}
                    <div className="relative group">
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="appearance-none bg-slate-900/50 backdrop-blur-md border border-slate-800 text-slate-300 text-sm font-semibold rounded-2xl px-5 py-4 pr-12 focus:outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer transition-luxury group-hover:border-slate-700"
                        >
                            <option value="newest">Recent</option>
                            <option value="oldest">Historical</option>
                            <option value="title">Alphabetical</option>
                        </select>
                        <ArrowUpDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>

                    {/* Layout Toggle */}
                    <div className="flex items-center p-1.5 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-2.5 rounded-xl transition-luxury",
                                viewMode === 'grid' ? "bg-slate-800 text-blue-400 shadow-xl border border-slate-700" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-2.5 rounded-xl transition-luxury",
                                viewMode === 'list' ? "bg-slate-800 text-blue-400 shadow-xl border border-slate-700" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <List size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Upload Dropzone (Animated) */}
        <AnimatePresence>
          {showUpload && (
            <motion.section 
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="overflow-hidden"
            >
                <div className="pb-8">
                  <UploadDropzone onUploadComplete={() => { fetchItems(); setShowUpload(false); }} />
                </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Archives Grid */}
        <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                Collective Archive
                <div className="h-[1px] w-12 bg-slate-800" />
                <span className="text-blue-500/80 tracking-normal lower font-mono">{items.length} units</span>
              </h2>
            </div>
            
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center rounded-[3rem] border border-dashed border-slate-800 bg-slate-900/20 group">
                    <div className="w-24 h-24 rounded-[2.5rem] bg-slate-900 border border-slate-800 flex items-center justify-center mb-8 shadow-2xl transition-luxury group-hover:scale-110">
                      <Archive className="w-10 h-10 text-slate-700" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3">No archived papers</h3>
                    <p className="text-slate-500 text-sm mb-10 max-w-xs font-medium">Ready for high-fidelity archival. Start by uploading documents for AI synthesis.</p>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="px-8 py-3.5 bg-white text-black text-sm font-black rounded-2xl hover:bg-slate-100 transition-luxury active:scale-95 shadow-xl shadow-white/5"
                    >
                      Initialize Archive
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {sortedItems.map((item, idx) => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <ItemCard item={item} />
                      </motion.div>
                    ))}
                </div>
            ) : (
                /* List View (Luxury Responsive) */
                <div className="space-y-3">
                    {sortedItems.map((item, idx) => {
                        const tags = item.tags ? JSON.parse(item.tags) : [];
                        return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                            >
                              <Link 
                                href={`/items/${item.id}`}
                                className="group flex items-center gap-5 p-4 rounded-3xl glass backdrop-blur-xl border border-slate-800/50 hover:border-blue-500/30 hover:bg-slate-900/60 transition-luxury active:scale-[0.995]"
                              >
                                  <div className="w-16 h-16 md:w-24 md:h-24 flex-shrink-0 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 group-hover:border-blue-500/50 transition-colors">
                                      {item.thumbnailPath ? (
                                          <img src={`/api/items/${item.id}/thumbnail`} className="w-full h-full object-cover group-hover:scale-110 transition-luxury" alt="" />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                              <Archive className="w-8 h-8 text-slate-800" />
                                          </div>
                                      )}
                                  </div>
                                  
                                  <div className="flex-grow min-w-0">
                                      <div className="flex items-center justify-between mb-2">
                                          <h3 className="text-lg font-black text-slate-100 group-hover:text-blue-400 transition-colors truncate pr-4">
                                            {item.title || "Synthesizing..."}
                                          </h3>
                                          <span className="text-[10px] font-mono text-slate-700 hidden md:inline-block tracking-tighter opacity-50">
                                            ID: {item.id}
                                          </span>
                                      </div>
                                      
                                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold">
                                          <div className="flex items-center gap-1.5 text-slate-500">
                                              <Calendar size={14} className="text-slate-600" />
                                              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                          </div>
                                          
                                          {item.valuation && (
                                              <div className="flex items-center gap-1.5 text-emerald-400">
                                                  <DollarSign size={14} strokeWidth={2.5} />
                                                  <span className="tracking-tight">{item.valuation}</span>
                                              </div>
                                          )}

                                          {tags.length > 0 && (
                                              <div className="flex items-center gap-2">
                                                  {tags.slice(0, 3).map((tag: string, i: number) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400/80 text-[10px] border border-blue-500/10">
                                                      {tag}
                                                    </span>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                      
                                      {item.historicalContext && (
                                          <p className="text-sm text-slate-500 mt-3 line-clamp-1 hidden sm:block font-medium">
                                              {item.historicalContext}
                                          </p>
                                      )}
                                  </div>

                                  <div className="flex-shrink-0 flex flex-col items-center gap-3 pr-2">
                                      <div className={cn(
                                          "w-2.5 h-2.5 rounded-full",
                                          item.status === 'complete' ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" :
                                          item.status === 'error' ? "bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]" :
                                          "bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                                      )} />
                                      <Plus size={16} className="text-slate-700 group-hover:text-blue-500 group-hover:rotate-90 transition-luxury" />
                                  </div>
                              </Link>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </section>
      </div>
      <Toaster />
    </main>
  );
}
