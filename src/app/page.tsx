"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { BulkUpload } from '@/components/BulkUpload';
import { ItemCard } from '@/components/ItemCard';
import { ProcessingPhaseIndicator } from '@/components/ProcessingPhaseIndicator';
import { TreasureFoundEffect } from '@/components/TreasureFoundEffect';
import { 
  Loader2, 
  Search, 
  Archive, 
  Plus, 
  LayoutGrid, 
  List,
  DollarSign,
  Sparkles,
    Layers3, 
    Trash2
  } from 'lucide-react';
  import { toast } from 'sonner';
  import { cn } from '@/lib/utils';import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ExportMenu } from '@/components/ExportMenu';
import { StatsBar } from '@/components/StatsBar';
import { FilterBar } from '@/components/FilterBar';
import { useItemStore } from '@/store/itemStore';
import { useItems } from '@/hooks/useItems';
import { ItemDetailModal } from '@/components/ItemDetailModal';
import type { Item } from '@/lib/db/items';

type SortOption = 'newest' | 'oldest' | 'title';

const SkeletonCard = () => (
  <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-1 overflow-hidden aspect-square">
    <div className="w-full h-full bg-slate-800 animate-shimmer rounded-lg" />
  </div>
);

export default function Dashboard() {
  const items = useItemStore(state => state.items);
  const loading = useItemStore(state => state.status === 'loading');
  const query = useItemStore(state => state.query);
  const setQuery = useItemStore(state => state.setQuery);
  const filters = useItemStore(state => state.filters);
  const setFilters = useItemStore(state => state.setFilters);
  const setSelectedItemId = useItemStore(state => state.setSelectedItemId);
  const nukeArchive = useItemStore(state => state.nukeArchive);
  
  const { isLoading: queryLoading } = useItems();
  const isActuallyLoading = loading || queryLoading;
  
  const searchParams = useSearchParams();
  const [showUpload, setShowUpload] = useState(searchParams.get('upload') === 'true');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [nuking, setNuking] = useState(false);
  
  const [treasureTrigger, setTreasureTrigger] = useState(false);
  const prevItemsRef = useRef<Set<string>>(new Set());
  
  const handleNuke = async () => {
    if (!confirm("PURGE ENTIRE ARCHIVE? This action is irreversible.")) return;
    setNuking(true);
    try {
      await nukeArchive();
      toast.success("Archive Purged", { description: "Vault has been zeroed out." });
    } catch (err: any) {
      toast.error("Critical Fault", { description: "Archive purge failed." });
    } finally {
      setNuking(false);
    }
  };

  useEffect(() => {
    const completedHighValue = items.filter(
      i => i.status === 'complete' && i.is_high_value && !prevItemsRef.current.has(i.id)
    );
    if (completedHighValue.length > 0) {
      setTreasureTrigger(t => !t);
    }
    items.forEach(i => {
      if (i.status === 'complete') prevItemsRef.current.add(i.id);
    });
  }, [items]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      return 0;
    });
  }, [items, sortBy]);

  const hasProcessing = items.some(i =>
    ['queued','processing_ocr','ocr_complete','processing_resize','resize_complete','processing_ai']
    .includes(i.status)
  );

  const categories = useMemo(() => [...new Set(items.map(i => i.category).filter(Boolean))], [items]) as string[];
  const counts = useMemo(() => ({
    interested: items.filter(i => i.purchase_decision === 'interested').length,
    purchased: items.filter(i => i.purchase_decision === 'purchased').length,
    passed: items.filter(i => i.purchase_decision === 'passed').length,
    high_value: items.filter(i => i.is_high_value).length,
  }), [items]);

  return (
    <div className="p-8 md:p-12 lg:p-16 space-y-12">
      <TreasureFoundEffect trigger={treasureTrigger} />
      
      {/* Refined Minimal Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-2xl">
                  <Layers3 size={20} className="text-slate-950" strokeWidth={3} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tighter leading-none">Archive Vault</h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                      <Sparkles size={10} className="text-blue-500" /> Professional Ingest 2.0
                    </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
                <ExportMenu />
                
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] shadow-lg",
                    showUpload 
                        ? "bg-slate-800 text-white border border-white/10" 
                        : "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20"
                  )}
                >
                  <Plus size={16} className={cn("transition-transform duration-500", showUpload && "rotate-45")} />
                  <span>{showUpload ? "Cancel Ingest" : "Ingest Assets"}</span>
                </button>

                <div className="h-8 w-[1px] bg-white/5 mx-2" />

                <button
                  onClick={handleNuke}
                  disabled={nuking}
                  className="p-2.5 rounded-xl border border-white/5 bg-white/5 text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all disabled:opacity-50"
                  title="Purge Archive"
                >
                  {nuking ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
            </div>
        </header>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-1 shadow-inner">
            <StatsBar 
                total={items.length}
                complete={items.filter(i => i.status === 'complete').length}
                high_value={counts.high_value}
                interested={counts.interested}
                total_value={items.reduce((acc, i) => acc + (i.estimated_value_point || 0), 0)}
            />
        </div>
        
        {/* Utility Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative group w-full md:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search archival sequences..." 
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/5 bg-slate-900/50 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-3 ml-auto">
                <div className="flex items-center p-1 bg-slate-900/50 border border-white/5 rounded-xl shadow-inner">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            viewMode === 'grid' ? "bg-white text-slate-950 shadow-md" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <LayoutGrid size={16} />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            viewMode === 'list' ? "bg-white text-slate-950 shadow-md" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <List size={16} />
                    </button>
                </div>

                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none bg-slate-900/50 border border-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl px-6 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-all hover:border-white/10"
                >
                    <option value="newest">Recent</option>
                    <option value="oldest">Legacy</option>
                    <option value="title">Alphabetical</option>
                </select>
            </div>
        </div>

        <AnimatePresence>
          {showUpload && (
            <motion.section 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pb-8"
            >
                <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-8 shadow-inner">
                  <BulkUpload />
                </div>
            </motion.section>
          )}
        </AnimatePresence>
        
        <div className="flex justify-between items-center py-4 border-t border-white/5">
            <ProcessingPhaseIndicator isActive={hasProcessing} />
            <FilterBar filters={filters} onChange={setFilters} categories={categories} counts={counts} />
        </div>

        <section className="space-y-6">
            <div className="flex items-center gap-4">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Vault Inventory</h2>
                <div className="h-[1px] flex-grow bg-white/5" />
                <span className="text-[10px] font-mono text-slate-600">[{items.length} units]</span>
            </div>
            
            {isActuallyLoading && items.length === 0 ? (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                  {[...Array(20)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center rounded-2xl border border-dashed border-white/5 bg-white/[0.01]">
                    <Archive className="w-12 h-12 text-slate-800 mb-6" />
                    <h3 className="text-sm font-black text-slate-500 mb-8 uppercase tracking-widest">Archive Empty</h3>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="px-8 py-3 bg-white text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all shadow-xl shadow-white/5"
                    >
                      Initialize First Ingest
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                <motion.div layout className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                    <AnimatePresence mode="popLayout">
                        {sortedItems.map((item) => (
                          <ItemCard key={item.id} item={item} />
                        ))}
                    </AnimatePresence>
                </motion.div>
            ) : (
                <motion.div layout className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {sortedItems.map((item, idx) => {
                            return (
                                <motion.div
                                  layout
                                  key={item.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  transition={{ delay: idx * 0.01 }}
                                >
                                  <div 
                                    onClick={() => setSelectedItemId(item.id)}
                                    className="group flex items-center gap-4 p-2 pr-6 rounded-xl border border-white/5 bg-slate-900/20 hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer"
                                  >
                                      <div className="w-10 h-10 flex-shrink-0 bg-slate-950 rounded-lg overflow-hidden border border-white/5 shadow-inner">
                                          {item.thumbnailPath ? (
                                              <img src={`/api/items/${item.id}/thumbnail`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center">
                                                  <Archive size={14} className="text-slate-800" />
                                              </div>
                                          )}
                                      </div>
                                      
                                      <div className="flex-grow min-w-0 flex items-center gap-6">
                                          <h3 className="text-[12px] font-bold text-slate-300 group-hover:text-white transition-colors truncate flex-grow">
                                            {item.title || "Unidentified Unit"}
                                          </h3>
                                          
                                          <div className="hidden md:flex items-center gap-8 flex-shrink-0">
                                              {item.estimated_value_point && (
                                                  <div className="flex items-center gap-1.5 text-emerald-500 text-[11px] font-black tabular-nums w-24">
                                                      <DollarSign size={12} strokeWidth={3} />
                                                      {item.estimated_value_point.toLocaleString()}
                                                  </div>
                                              )}
                                              
                                              <div className="w-32 text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                                                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                              </div>
                                          </div>
                                      </div>

                                      <div className={cn(
                                          "w-2 h-2 rounded-full",
                                          item.status === 'complete' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
                                          item.status === 'error' ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                                          "bg-blue-500 animate-pulse"
                                      )} />
                                  </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            )}
        </section>

        <ItemDetailModal />
    </div>
  );
}
