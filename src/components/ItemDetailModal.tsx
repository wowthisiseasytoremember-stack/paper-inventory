"use client";

import { useEffect, useState } from 'react';
import { 
  X,
  Calendar, 
  History, 
  Target, 
  FileText, 
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  DollarSign,
  Sparkles,
  Search,
  Maximize2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { ResearchContextPanel } from '@/components/ResearchContextPanel';
import { ValuationBlock } from '@/components/ValuationBlock';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { useItemStore } from '@/store/itemStore';
import { useQuery } from '@tanstack/react-query';

export function ItemDetailModal() {
  const selectedItemId = useItemStore(state => state.selectedItemId);
  const setSelectedItemId = useItemStore(state => state.setSelectedItemId);
  const updateItemStatus = useItemStore(state => state.updateItemStatus);
  const retryItem = useItemStore(state => state.retryItem);
  const storeItems = useItemStore(state => state.items);
  
  const id = selectedItemId;
  const item = storeItems.find(i => i.id === id);
  
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const { data: fetchedItem, isLoading } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await fetch(`/api/items/${id}`);
      if (!res.ok) throw new Error('Failed to fetch item');
      return res.json();
    },
    enabled: !!id,
    refetchInterval: (data) => {
        if (data && !['complete', 'error'].includes(data.status)) return 3000;
        return false;
    }
  });

  useEffect(() => {
    if (fetchedItem) {
        updateItemStatus(fetchedItem.id, fetchedItem.status, fetchedItem);
    }
  }, [fetchedItem, updateItemStatus]);

  // Lock scroll when open
  useEffect(() => {
    if (id) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [id]);

  if (!id) return null;

  const displayItem = fetchedItem || item;

  if (!displayItem && isLoading) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500" />
        </div>
      );
  }

  if (!displayItem) return null;

  const isComplete = displayItem.status === 'complete';
  const isError = displayItem.status === 'error';
  const isProcessing = !isComplete && !isError;
  
  const statusToProgress = (status: string) => {
    switch (status) {
      case 'queued': return { label: 'Queued', percent: 0 };
      case 'processing_ocr': return { label: 'OCR', percent: 20 };
      case 'ocr_complete': return { label: 'OCR Complete', percent: 35 };
      case 'processing_resize': return { label: 'Image Prep', percent: 50 };
      case 'resize_complete': return { label: 'AI Queued', percent: 65 };
      case 'processing_ai': return { label: 'AI Pipeline', percent: 85 };
      case 'complete': return { label: 'Complete', percent: 100 };
      case 'error': return { label: 'Error', percent: 100 };
      default: return { label: status.replace(/_/g, ' '), percent: 0 };
    }
  };

  const progress = statusToProgress(displayItem.status);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryItem(displayItem.id);
      toast.success('System re-initialized');
    } catch (err: any) {
      toast.error('Calibration failure');
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayItem.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {id && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 lg:p-24">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedItemId(null)}
            className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="relative w-full max-w-7xl h-full bg-slate-900 border border-white/5 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/50">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSelectedItemId(null)}
                        className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="h-4 w-[1px] bg-white/10" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Archival Unit Explorer</span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleCopyId}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
                    >
                        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        {displayItem.id.slice(0, 8)}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-8 md:p-12 space-y-12">
                {/* Header Context */}
                <div className="space-y-4 max-w-4xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                            "px-2.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border",
                            isComplete ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20" :
                            isError ? "bg-red-500/5 text-red-400 border-red-500/20" :
                            "bg-blue-500/5 text-blue-400 border-blue-500/20 animate-pulse"
                        )}>
                            {displayItem.status.replace(/_/g, ' ')}
                        </span>
                        {displayItem.category && (
                            <span className="px-2.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5 text-[9px] font-black tracking-widest uppercase">
                                {displayItem.category}
                            </span>
                        )}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
                        {displayItem.title || (isProcessing ? "Synthesizing Archive..." : "Unidentified Unit")}
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* Main Content */}
                    <div className="lg:col-span-8 space-y-12">
                        {/* Primary Asset */}
                        <div className="bg-slate-950 rounded-lg border border-white/5 overflow-hidden shadow-2xl">
                            <div className="aspect-auto min-h-[400px] flex items-center justify-center relative group">
                                <img 
                                    src={`/api/items/${displayItem.id}/image`} 
                                    alt={displayItem.title || "Archive Preview"} 
                                    className={cn(
                                        "max-w-full h-auto transition-all duration-1000",
                                        isProcessing ? 'grayscale blur-xl opacity-50' : 'grayscale-0 blur-none opacity-100'
                                    )}
                                />
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="absolute bottom-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    <button 
                                        onClick={() => window.open(`/api/items/${displayItem.id}/image`, '_blank')}
                                        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors shadow-xl"
                                    >
                                        <Maximize2 size={14} /> Full Resolution
                                    </button>
                                </div>

                                {isProcessing && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.3em]">AI Synthesis Engine Active</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Intelligence Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <History size={14} />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Historical Context</h3>
                                </div>
                                <div className="text-slate-300 text-sm leading-relaxed font-medium prose prose-invert prose-slate max-w-none">
                                    <ReactMarkdown>{displayItem.historicalContext || "Awaiting neural synthesis..."}</ReactMarkdown>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Sparkles size={14} />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Collector Value</h3>
                                </div>
                                <div className="text-slate-300 text-sm leading-relaxed font-medium prose prose-invert prose-slate max-w-none">
                                    <ReactMarkdown>{displayItem.collectorSignificance || "Analyzing market rarity..."}</ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        {/* OCR Raw Data */}
                        <div className="space-y-4 pt-12 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <FileText size={14} />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Raw Transcription</h3>
                                </div>
                                {displayItem.cleanedTranscription && (
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(displayItem.cleanedTranscription || '');
                                            toast.success('Transcription copied');
                                        }}
                                        className="text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors"
                                    >
                                        Copy Text
                                    </button>
                                )}
                            </div>
                            <div className="bg-slate-950/50 rounded-lg p-6 border border-white/5 font-mono text-xs leading-relaxed text-slate-500 max-h-64 overflow-y-auto custom-scrollbar">
                                {displayItem.cleanedTranscription || "No text data detected."}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Actions */}
                    <div className="lg:col-span-4 space-y-12">
                        {/* Valuation Panel */}
                        <div className="space-y-8 p-8 bg-white/[0.02] border border-white/5 rounded-xl">
                            <ValuationBlock
                                estimated_value_low={displayItem.estimated_value_low ?? null}
                                estimated_value_high={displayItem.estimated_value_high ?? null}
                                estimated_value_point={displayItem.estimated_value_point ?? null}
                                value_confidence={displayItem.value_confidence as any}
                                is_high_value={displayItem.is_high_value || false}
                                ebay_keywords={displayItem.ebay_keywords ?? null}
                            />
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
                                    <span>Ingestion Progress</span>
                                    <span>{progress.percent}%</span>
                                </div>
                                <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all duration-1000",
                                            isError ? "bg-red-500" : isComplete ? "bg-emerald-500" : "bg-blue-500"
                                        )}
                                        style={{ width: `${progress.percent}%` }}
                                    />
                                </div>
                            </div>

                            {isError && (
                                <button 
                                    onClick={handleRetry}
                                    disabled={retrying}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-400 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
                                    Force Reset Engine
                                </button>
                            )}
                        </div>

                        {/* Research Context Form */}
                        <div className="px-4">
                            <ResearchContextPanel 
                                itemId={displayItem.id} 
                                initial={{
                                    research_location: displayItem.research_location || '',
                                    asking_price: displayItem.asking_price || '',
                                    purchase_decision: displayItem.purchase_decision || 'undecided',
                                    research_notes: displayItem.research_notes || '',
                                }} 
                            />
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
