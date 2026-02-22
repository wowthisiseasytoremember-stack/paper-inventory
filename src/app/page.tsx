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
  Filter,
  Layers3
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
  <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-1 overflow-hidden aspect-square">
    <div className="w-full h-full bg-slate-800 animate-shimmer rounded-lg" />
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
    <main className="min-h-screen bg-slate-950 text-slate-200 p-3 md:p-6 selection:bg-blue-500/30">
      {/* Ambient background glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto space-y-6 fade-in">
        
        {/* Compact Header */}
        <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Layers3 size={18} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="hidden sm:block">
                  <h1 className="text-lg font-black text-white tracking-tight leading-none mb-0.5">Vault</h1>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Sparkles size={10} className="text-blue-500" /> Pro 2.0 Ingest
                  </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-luxury active:scale-95 shadow-sm",
                    showUpload ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-blue-600 text-white border-blue-500 hover:bg-blue-500"
                  )}
                >
                  <Plus size={16} className={cn("transition-transform duration-500", showUpload && "rotate-45")} />
                  <span className="hidden xs:inline">{showUpload ? "Cancel" : "Add Papers"}</span>
                </button>
            </div>
        </header>
        
        {/* Compact Controls */}
        <div className="flex flex-col md:flex-row gap-2">
            <div className="relative group flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 w-3.5 h-3.5" />
                <input 
                    type="text" 
                    placeholder="Search sequence..." 
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-900 bg-slate-900/60 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-luxury text-xs backdrop-blur-md"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-2">
                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none bg-slate-900/50 backdrop-blur-md border border-slate-900 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-luxury"
                >
                    <option value="newest">Recent</option>
                    <option value="oldest">Legacy</option>
                    <option value="title">A-Z</option>
                </select>

                <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            "p-1.5 rounded-lg transition-luxury",
                            viewMode === 'grid' ? "bg-slate-800 text-blue-400 shadow-sm" : "text-slate-600 hover:text-slate-400"
                        )}
                    >
                        <LayoutGrid size={14} />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={cn(
                            "p-1.5 rounded-lg transition-luxury",
                            viewMode === 'list' ? "bg-slate-800 text-blue-400 shadow-sm" : "text-slate-600 hover:text-slate-400"
                        )}
                    >
                        <List size={14} />
                    </button>
                </div>
            </div>
        </div>

        <AnimatePresence>
          {showUpload && (
            <motion.section 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
                <div className="pb-4">
                  <UploadDropzone onUploadComplete={() => { fetchItems(); setShowUpload(false); }} />
                </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Dense Grid/List */}
        <section className="space-y-4">
            <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
              Sequence Log <span className="text-blue-500/50">[{items.length}]</span>
            </h2>
            
            {loading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                  {[...Array(20)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center rounded-[2rem] border border-slate-900 bg-slate-900/10">
                    <Archive className="w-8 h-8 text-slate-800 mb-4" />
                    <h3 className="text-sm font-black text-slate-400 mb-6">Archive Empty</h3>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 transition-luxury active:scale-95"
                    >
                      Init Sequence
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                    {sortedItems.map((item, idx) => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.01 }}
                      >
                        <ItemCard item={item} />
                      </motion.div>
                    ))}
                </div>
            ) : (
                /* Tiny List View */
                <div className="space-y-1">
                    {sortedItems.map((item, idx) => {
                        const tags = item.tags ? JSON.parse(item.tags) : [];
                        return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.01 }}
                            >
                              <Link 
                                href={`/items/${item.id}`}
                                className="group flex items-center gap-3 p-1.5 pr-4 rounded-xl glass border border-transparent hover:border-slate-800 hover:bg-slate-900/40 transition-luxury"
                              >
                                  <div className="w-8 h-8 flex-shrink-0 bg-slate-950 rounded-lg overflow-hidden border border-slate-900">
                                      {item.thumbnailPath ? (
                                          <img src={`/api/items/${item.id}/thumbnail`} className="w-full h-full object-cover group-hover:scale-110 transition-luxury" alt="" />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                              <Archive size={12} className="text-slate-800" />
                                          </div>
                                      )}
                                  </div>
                                  
                                  <div className="flex-grow min-w-0 flex items-center gap-4">
                                      <h3 className="text-[11px] font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate flex-grow">
                                        {item.title || "Processing..."}
                                      </h3>
                                      
                                      <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                                          {item.valuation && (
                                              <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-black tracking-tighter w-20">
                                                  <DollarSign size={10} />
                                                  {item.valuation}
                                              </div>
                                          )}
                                          
                                          <div className="w-24 text-[9px] font-bold text-slate-600 uppercase tracking-tighter">
                                              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: false })}
                                          </div>
                                      </div>
                                  </div>

                                  <div className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      item.status === 'complete' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" :
                                      item.status === 'error' ? "bg-red-500" :
                                      "bg-blue-500 animate-pulse"
                                  )} />
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
