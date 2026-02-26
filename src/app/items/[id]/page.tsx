"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
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
import { Toaster } from '@/components/ui/toaster';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { ResearchContextPanel } from '@/components/ResearchContextPanel';
import { ValuationBlock } from '@/components/ValuationBlock';
import type { PurchaseDecision } from '@/types/research';

interface Entity {
  name: string;
  type: string;
  confidence: number;
}

interface AnalysisEntry {
  timestamp: string;
  category: string;
  conductor_confidence: number;
  expert_extracted_title: string;
  extracted_fields: {
    identified_names: string[];
    historical_context: string;
    collector_significance: string;
    estimated_value_signals: string[];
    condition_issues: string[];
    ebay_keywords: string[];
  };
}

interface Item {
  id: string;
  status: string;
  title?: string;
  guessedId?: string;
  rawOcr?: string;
  cleanedTranscription?: string;
  confidence?: number;
  identifiedNames?: Entity[] | string;
  historicalContext?: string;
  collectorSignificance?: string;
  valuation?: string;
  originalImagePath?: string;
  resizedImagePath?: string;
  thumbnailPath?: string;
  tags?: string[];
  analysis_history?: string; // JSON array of AnalysisEntry
  createdAt: string;
  processedAt?: string;
  errorMessage?: string;
  aiDurationMs?: number;
  totalProcessingMs?: number;
  statusUpdatedAt?: string;
  watchdogLockedAt?: string;
  user_decision?: string;

  // Research Context fields
  research_location?: string | null;
  asking_price?: string | null;
  purchase_decision?: PurchaseDecision;
  research_notes?: string | null;
  estimated_value_low?: number | null;
  estimated_value_high?: number | null;
  estimated_value_point?: number | null;
  value_confidence?: string | null;
  is_high_value?: boolean;
  ebay_keywords?: string | null;
}

export default function ItemDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [refinementNote, setRefinementNote] = useState('');
  const [isUpdatingDecision, setIsUpdatingDecision] = useState(false);

  const fetchItem = async () => {
    try {
      const res = await fetch(`/api/items/${id}`);
      if (!res.ok) throw new Error('Failed to fetch item');
      const data = await res.json();
      setItem(data);
    } catch (err) {
      console.error(err);
      toast.error('Could not load archive unit');
    } finally {
      setLoading(false);
    }
  };

  const updateDecision = async (decision: 'buy' | 'pass' | 'research' | 'none') => {
    if (!item) return;
    setIsUpdatingDecision(true);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_decision: decision })
      });
      if (!res.ok) throw new Error('Failed to update decision');
      setItem({ ...item, user_decision: decision });
      toast.success(`Decision set to ${decision.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to save decision:', err);
      toast.error('Failed to save');
    } finally {
      setIsUpdatingDecision(false);
    }
  };

  useEffect(() => {
    fetchItem();
    const interval = setInterval(() => {
      if (item && !['complete', 'error'].includes(item.status)) {
        fetchItem();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, item?.status]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        router.push('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/items/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('System re-initialized', { description: 'Re-queued for deep analysis.' });
      fetchItem();
    } catch (err: any) {
      toast.error(err.message || 'Calibration failure');
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(item?.id || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetStalled = async () => {
    if (!item) return;
    const toastId = toast.loading('Resetting stalled job...', {
      description: 'Re-queuing for fresh processing.'
    });

    try {
      const res = await fetch(`/api/items/${item.id}/reset`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      toast.success('Reset complete', { id: toastId });
      fetchItem();
    } catch (err: any) {
      toast.error('Reset failed', { id: toastId, description: err.message });
    }
  };

  const statusToProgress = (status: string) => {
    switch (status) {
      case 'queued':
        return { label: 'Queued', percent: 0 };
      case 'processing_ocr':
        return { label: 'OCR', percent: 20 };
      case 'ocr_complete':
        return { label: 'OCR Complete', percent: 35 };
      case 'processing_resize':
        return { label: 'Image Prep', percent: 50 };
      case 'resize_complete':
        return { label: 'AI Queued', percent: 65 };
      case 'processing_ai':
        return { label: 'AI Analysis', percent: 85 };
      case 'complete':
        return { label: 'Complete', percent: 100 };
      case 'error':
        return { label: 'Error', percent: 100 };
      default:
        return { label: status.replace(/_/g, ' '), percent: 0 };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-6">
        <div className="relative">
          <div className="h-16 w-16 rounded-3xl border-4 border-blue-500/10 border-t-blue-500 animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 w-6 h-6 animate-pulse" suppressHydrationWarning />
        </div>
        <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] animate-pulse">Initializing Interface...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full glass p-10 rounded-[3rem] text-center space-y-6 border-red-500/20 shadow-2xl shadow-red-500/5">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Archive Unit Null</h1>
            <p className="text-slate-500 text-sm">The requested sequence ID does not exist in the central vault.</p>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="w-full py-4 bg-slate-800 text-slate-200 text-sm font-black rounded-2xl hover:bg-slate-700 transition-luxury active:scale-95"
          >
            Return to Vault
          </button>
        </div>
      </div>
    );
  }

  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';
  const isProcessing = !isComplete && !isError;
  const progress = statusToProgress(item.status);
  const lastUpdateIso = item.statusUpdatedAt || item.watchdogLockedAt || item.createdAt;
  const lastUpdateMs = new Date(lastUpdateIso).getTime();
  const STALL_THRESHOLD_MS = 5 * 60 * 1000;
  const isStalled = isProcessing && Date.now() - lastUpdateMs > STALL_THRESHOLD_MS;
  const statusTimeline = [
    { key: 'queued', label: 'Queued' },
    { key: 'processing_resize', label: 'Image Prep' },
    { key: 'processing_ai', label: 'AI Analysis' },
    { key: 'complete', label: 'Complete' }
  ];

  const statusStep = (status: string) => {
    if (status === 'queued') return 0;
    if (['processing_ocr', 'ocr_complete', 'processing_resize', 'resize_complete'].includes(status)) return 1;
    if (status === 'processing_ai') return 2;
    if (status === 'complete') return 3;
    return 0;
  };

  const currentStep = statusStep(item.status);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 overflow-x-hidden">
      {/* Dynamic Hero Header */}
      <div className="h-64 md:h-80 w-full relative overflow-hidden">
        {/* Background Layer (Blurred Original) */}
        <div className="absolute inset-0 z-0">
          <img 
            src={`/api/items/${item.id}/image`} 
            alt="" 
            className="w-full h-full object-cover blur-2xl opacity-20 scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/60 to-slate-950" />
        </div>
        
        {/* Animated Orbs */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute top-10 left-10 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] z-0" 
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 right-20 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-[120px] z-0" 
        />

        <div className="max-w-6xl mx-auto px-6 h-full flex flex-col justify-end pb-10 relative z-10">
          <button 
            onClick={() => router.push('/')}
            className="absolute top-8 left-6 group flex items-center gap-3"
          >
            <div className="p-3 rounded-2xl glass hover:bg-white/10 transition-luxury shadow-2xl border border-white/5">
              <ArrowLeft size={18} className="text-white group-hover:-translate-x-1 transition-transform" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/50 group-hover:text-white transition-colors">Return to Vault</span>
          </button>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn(
                "px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase backdrop-blur-3xl border shadow-2xl",
                isComplete ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/5" :
                isError ? "bg-red-500/10 text-red-400 border-red-500/30 shadow-red-500/5" :
                "bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse shadow-blue-500/5"
              )}>
                {item.status.replace(/_/g, ' ')}
              </span>
              
              {item.confidence != null && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-[10px] font-black tracking-widest text-white shadow-2xl">
                  <ShieldCheck size={14} className="text-cyan-400" />
                  {(item.confidence * 100).toFixed(0)}% <span className="text-white/30">CONFIDENCE</span>
                </div>
              )}
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-[0.9]">
              {item.title || (isProcessing ? "Synthesizing Archive..." : "Unidentified Unit")}
            </h1>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-4 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
          
          {/* Main Visuals & AI Core (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* High-Resolution Archive View */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="group glass rounded-[3rem] overflow-hidden shadow-3xl border border-white/5 p-3 md:p-5 relative"
            >
               <div className="aspect-auto min-h-[400px] flex items-center justify-center bg-slate-950/50 rounded-[2.2rem] border border-slate-900 overflow-hidden relative">
                  {!imageLoaded && (
                     <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                        <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin" />
                     </div>
                  )}
                  <img 
                    src={`/api/items/${item.id}/image`} 
                    alt={item.title || "Archive Preview"} 
                    onLoad={() => setImageLoaded(true)}
                    className={cn(
                      "max-w-full h-auto shadow-4xl transition-all duration-1000",
                      imageLoaded ? "scale-100 opacity-100" : "scale-110 opacity-0",
                      isProcessing ? 'grayscale blur-sm' : 'grayscale-0 blur-none'
                    )}
                  />
                  
                  {/* View Controls Overlay */}
                  <div className="absolute bottom-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-luxury translate-y-4 group-hover:translate-y-0">
                    <button 
                      onClick={() => window.open(`/api/items/${item.id}/image`, '_blank')}
                      className="p-4 bg-black/60 backdrop-blur-2xl text-white rounded-2xl hover:bg-black/80 border border-white/10 shadow-2xl group/btn"
                    >
                      <Maximize2 size={20} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                  </div>

                  {/* Processing HUD Overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/40 backdrop-blur-md">
                      <div className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white font-black text-sm rounded-full shadow-2xl animate-pulse">
                        <RefreshCw size={18} className="animate-spin" />
                        AI CORE PROCESSING
                      </div>
                      <p className="text-xs text-white/50 font-bold uppercase tracking-[0.2em]">Neural extraction in progress</p>
                    </div>
                  )}
               </div>
            </motion.div>

            {/* Reseller Valuation Dashboard */}
            <AnimatePresence>
              {isComplete && (item.identification || item.ebay_title) && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  <div className="glass rounded-[2rem] p-6 border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                      <Search size={12} /> Identification
                    </h4>
                    <p className="text-xs font-bold text-slate-200 leading-tight">
                      {item.identification || item.ebay_title}
                    </p>
                  </div>

                  <div className="glass rounded-[2rem] p-6 border border-blue-500/20 bg-blue-500/5 space-y-3">
                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={12} /> Market Score
                    </h4>
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-200">
                        {item.liquidity_score ? `${item.liquidity_score}/10 LIQUIDITY` : 'NO SCORE'}
                      </p>
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500" 
                          style={{ width: `${(item.liquidity_score || 0) * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="glass rounded-[2rem] p-6 border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                      <DollarSign size={12} /> Buy Target
                    </h4>
                    <p className="text-lg font-black text-emerald-400 tracking-tighter">
                      {item.target_buy_price || 'N/A'}
                    </p>
                  </div>

                  <div className="glass rounded-[2rem] p-6 border border-orange-500/20 bg-orange-500/5 space-y-3">
                    <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle size={12} /> Condition
                    </h4>
                    <ul className="space-y-1">
                      {item.visible_flaws?.slice(0, 2).map((flaw, i) => (
                        <li key={i} className="text-[9px] font-bold text-slate-300 truncate">
                          • {flaw}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Refinement Loop */}
            <AnimatePresence>
              {isComplete && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="glass rounded-[2rem] p-6 border border-blue-500/20 bg-blue-950/10 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-blue-400" />
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Expert Refinement</h4>
                  </div>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="e.g. 'D.D. Mayo was the CEO' or 'The back is signed'" 
                      className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
                      onChange={(e) => setRefinementNote(e.target.value)}
                      value={refinementNote}
                    />
                    <button 
                      onClick={() => {
                        if(!refinementNote) return;
                        toast.error('Refinement logic backend requires wiring to AI. Coming soon!');
                        setRefinementNote('');
                      }}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-luxury shadow-lg shadow-blue-500/20 whitespace-nowrap"
                    >
                      Recalculate
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dealer Research Pathways (If Uncertain) */}
            <AnimatePresence>
              {isComplete && item.research_pathways && item.research_pathways.length > 0 && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="glass rounded-[2.5rem] p-8 border border-purple-500/20 bg-purple-500/5 space-y-4"
                >
                  <div className="flex items-center gap-3 text-purple-400 pb-2 border-b border-white/5">
                    <Sparkles size={20} />
                    <h3 className="text-sm font-black uppercase tracking-[0.1em]">Expert Research Pathways</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {item.research_pathways.map((path, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed">{path}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Archival Research Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Historical Synthesis */}
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="glass rounded-[2.5rem] p-8 border border-white/5 space-y-4 shadow-xl"
                >
                  <div className="flex items-center gap-3 text-blue-400 pb-2 border-b border-white/5">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <History size={20} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.1em]">Historical Synthesis</h3>
                  </div>
                  <div className="text-slate-300 text-sm leading-relaxed font-medium prose prose-invert prose-blue max-w-none prose-p:mb-4 prose-li:mb-1 prose-ul:my-4">
                    {item.historicalContext ? (
                      <ReactMarkdown>{item.historicalContext}</ReactMarkdown>
                    ) : (
                      <p>{isProcessing ? "Reconstructing era-appropriate context..." : "Context synthesis unavailable."}</p>
                    )}
                  </div>
                </motion.div>

                {/* Collector Significance */}
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="glass rounded-[2.5rem] p-8 border border-white/5 space-y-4 shadow-xl"
                >
                  <div className="flex items-center gap-3 text-indigo-400 pb-2 border-b border-white/5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                      <Sparkles size={20} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.1em]">Archival Value</h3>
                  </div>
                  <div className="text-slate-300 text-sm leading-relaxed font-medium prose prose-invert prose-indigo max-w-none prose-p:mb-4 prose-li:mb-1 prose-ul:my-4">
                    {item.collectorSignificance ? (
                      <ReactMarkdown>{item.collectorSignificance}</ReactMarkdown>
                    ) : (
                      <p>{isProcessing ? "Evaluating rarity and uniqueness factors..." : "Significance patterns not detected."}</p>
                    )}
                  </div>
                </motion.div>
            </div>

            {/* Analysis Intelligence - NEW GCV/AI Pipeline Results */}
            <AnimatePresence>
              {item.analysis_history && (() => {
                try {
                  const history = JSON.parse(item.analysis_history) as AnalysisEntry[];
                  const latestAnalysis = history[history.length - 1];
                  if (!latestAnalysis) return null;

                  return (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="space-y-6 border-t border-white/5 pt-8"
                    >
                      {/* Category & Confidence */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <motion.div
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="glass rounded-[2rem] p-6 border border-green-500/20 bg-green-500/5"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Target size={16} className="text-green-400" />
                            <h4 className="text-xs font-black text-green-400 uppercase tracking-widest">Category</h4>
                          </div>
                          <p className="text-2xl font-black text-green-300 mb-2">{latestAnalysis.category.replace(/_/g, ' ').toUpperCase()}</p>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{width: `${latestAnalysis.conductor_confidence * 100}%`}} />
                          </div>
                          <p className="text-xs text-slate-400 mt-2">{(latestAnalysis.conductor_confidence * 100).toFixed(1)}% confidence</p>
                        </motion.div>

                        <motion.div
                          initial={{ x: 20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="glass rounded-[2rem] p-6 border border-purple-500/20 bg-purple-500/5"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={16} className="text-purple-400" />
                            <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest">Identified Names</h4>
                          </div>
                          <div className="space-y-1">
                            {latestAnalysis.extracted_fields.identified_names.length > 0 ? (
                              latestAnalysis.extracted_fields.identified_names.slice(0, 3).map((name, i) => (
                                <p key={i} className="text-sm text-purple-200">• {name}</p>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500">No names identified</p>
                            )}
                          </div>
                        </motion.div>
                      </div>

                      {/* Condition Issues & Value Signals */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <motion.div
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="glass rounded-[2rem] p-6 border border-orange-500/20 bg-orange-500/5"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle size={16} className="text-orange-400" />
                            <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">Condition Issues</h4>
                          </div>
                          <div className="space-y-1">
                            {latestAnalysis.extracted_fields.condition_issues.length > 0 ? (
                              latestAnalysis.extracted_fields.condition_issues.map((issue, i) => (
                                <p key={i} className="text-sm text-orange-200">• {issue}</p>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500">No major condition issues detected</p>
                            )}
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ x: 20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="glass rounded-[2rem] p-6 border border-yellow-500/20 bg-yellow-500/5"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <DollarSign size={16} className="text-yellow-400" />
                            <h4 className="text-xs font-black text-yellow-400 uppercase tracking-widest">Value Signals</h4>
                          </div>
                          <div className="space-y-1">
                            {latestAnalysis.extracted_fields.estimated_value_signals.length > 0 ? (
                              latestAnalysis.extracted_fields.estimated_value_signals.map((signal, i) => (
                                <p key={i} className="text-sm text-yellow-200">• {signal}</p>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500">No premium value indicators</p>
                            )}
                          </div>
                        </motion.div>
                      </div>

                      {/* eBay Keywords */}
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="glass rounded-[2rem] p-6 border border-blue-500/20 bg-blue-500/5"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <Search size={16} className="text-blue-400" />
                          <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest">eBay Search Keywords</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {latestAnalysis.extracted_fields.ebay_keywords.map((keyword, i) => (
                            <span key={i} className="px-3 py-1 bg-blue-500/10 text-blue-300 rounded-lg text-xs font-bold border border-blue-500/30">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </motion.div>

                      {/* Historical Context from Expert */}
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="glass rounded-[2rem] p-6 border border-indigo-500/20 bg-indigo-500/5"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <History size={16} className="text-indigo-400" />
                          <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Expert Context</h4>
                        </div>
                        <div className="text-slate-300 text-sm leading-relaxed prose prose-invert prose-indigo max-w-none">
                          {latestAnalysis.extracted_fields.historical_context ? (
                            <ReactMarkdown>{latestAnalysis.extracted_fields.historical_context}</ReactMarkdown>
                          ) : (
                            <p className="text-xs text-slate-500">No historical context extracted</p>
                          )}
                        </div>
                      </motion.div>

                      {/* Collector Significance from Expert */}
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="glass rounded-[2rem] p-6 border border-cyan-500/20 bg-cyan-500/5"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles size={16} className="text-cyan-400" />
                          <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest">Collector Significance</h4>
                        </div>
                        <div className="text-slate-300 text-sm leading-relaxed prose prose-invert prose-cyan max-w-none">
                          {latestAnalysis.extracted_fields.collector_significance ? (
                            <ReactMarkdown>{latestAnalysis.extracted_fields.collector_significance}</ReactMarkdown>
                          ) : (
                            <p className="text-xs text-slate-500">No collector significance identified</p>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                } catch (e) {
                  return null;
                }
              })()}
            </AnimatePresence>

            {/* Deep Transcription Card */}
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.5 }}
               className="glass rounded-[3rem] p-10 border border-white/5 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                    <FileText size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.1em]">Digital Reconstruction (OCR)</h3>
                </div>
                {item.cleanedTranscription && (
                   <button 
                    onClick={() => {
                       navigator.clipboard.writeText(item.cleanedTranscription || '');
                       toast.success('System: Text copied to memory');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black text-white/50 hover:text-white transition-luxury border border-white/5"
                   >
                     <Copy size={12} /> COPY DATA
                   </button>
                )}
              </div>
              
              <div className="relative group/text">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-[2rem] blur-xl opacity-0 group-hover/text:opacity-100 transition-luxury" />
                <div className="relative bg-slate-950/80 rounded-[2rem] p-8 font-mono text-[13px] md:text-sm leading-loose border border-white/5 text-slate-400 max-h-[40rem] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                   {item.cleanedTranscription || (isProcessing ? "Initiating deep visual scan and verbatim transcription..." : "Deep scan produced no text results.")}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Intelligence Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Primary Action / Valuation Card */}
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-[2.5rem] overflow-hidden border border-white/10 shadow-3xl bg-gradient-to-br from-indigo-950/30 to-slate-950/50"
            >
                <div className="p-8 space-y-6">
                   <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Research Decision</h3>
                      <div className="flex gap-1">
                        {(['buy', 'pass', 'research'] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => updateDecision(d)}
                            disabled={isUpdatingDecision}
                            className={cn(
                              "px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all",
                              item.user_decision === d 
                                ? (d === 'buy' ? "bg-emerald-500 text-white" : d === 'pass' ? "bg-red-500 text-white" : "bg-blue-500 text-white")
                                : "bg-white/5 text-slate-500 hover:bg-white/10"
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                   </div>
                   
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em] mb-1">Estimated Value</p>
                      <div className="text-3xl font-black text-emerald-400 tracking-tighter">
                        {item.valuation || (isProcessing ? "Evaluating..." : "TBD")}
                      </div>
                   </div>

                   {item.dealer_gut_check && (
                     <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 space-y-2">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Dealer Assessment</p>
                        <p className="text-[11px] font-medium text-slate-300 leading-relaxed italic">
                          "{item.dealer_gut_check}"
                        </p>
                     </div>
                   )}

                   <div className="space-y-3">
                     <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                       <span>{progress.label}</span>
                       <span>{progress.percent}%</span>
                     </div>
                     <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                       <div
                         className={cn(
                           "h-full transition-all duration-500",
                           isError ? "bg-red-500" : isComplete ? "bg-emerald-500" : "bg-blue-500"
                         )}
                         style={{ width: `${progress.percent}%` }}
                       />
                     </div>
                   <div className={cn(
                       "text-[10px] font-bold uppercase tracking-widest",
                       isStalled ? "text-red-400" : "text-slate-500"
                     )}>
                       {isStalled
                         ? `No update for ${formatDistanceToNow(new Date(lastUpdateIso), { addSuffix: true })}`
                         : `Last update ${formatDistanceToNow(new Date(lastUpdateIso), { addSuffix: true })}`}
                    </div>

                    {isStalled && (
                      <button
                        onClick={handleResetStalled}
                        className="w-full mt-2 py-2 bg-red-600/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/30 hover:bg-red-600/30 transition-luxury"
                      >
                        Reset Stalled Job
                      </button>
                    )}

                    <div className="pt-2 space-y-2">
                      {statusTimeline.map((step, idx) => {
                        const isDone = idx < currentStep;
                        const isActive = idx === currentStep && isProcessing;
                        return (
                          <div key={step.key} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                            <div className={cn(
                              "w-2.5 h-2.5 rounded-full border",
                              isDone ? "bg-emerald-500 border-emerald-400" :
                              isActive ? "bg-blue-500 border-blue-400 animate-pulse" :
                              "bg-slate-800 border-slate-700"
                            )} />
                            <span className={cn(
                              isDone ? "text-emerald-400" :
                              isActive ? "text-blue-400" :
                              "text-slate-600"
                            )}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                   </div>

                   <div className="h-[1px] w-full bg-white/5" />

                   <button 
                      onClick={() => window.open(`/api/items/${item.id}/image`, '_blank')}
                      className="w-full group flex items-center justify-between py-4 px-6 bg-blue-600 text-white text-sm font-black rounded-2xl hover:bg-blue-500 transition-luxury shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                   >
                     VIEW SOURCE
                     <ExternalLink size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                   </button>
                </div>
                
                {/* Secondary Actions Row */}
                <div className="grid grid-cols-2 border-t border-white/5">
                   <button className="py-4 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-luxury border-r border-white/5">Export JSON</button>
                   <button className="py-4 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-luxury">Print Label</button>
                </div>
            </motion.div>
            
            {/* Phase 4: Research Context Panel */}
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="glass rounded-[2.5rem] p-8 border border-white/5 shadow-3xl bg-slate-950/40"
            >
               <ResearchContextPanel 
                 itemId={item.id} 
                 initial={{
                   research_location: item.research_location || '',
                   asking_price: item.asking_price || '',
                   purchase_decision: item.purchase_decision || 'undecided',
                   research_notes: item.research_notes || '',
                 }} 
               />
            </motion.div>
            
            {/* Unit Metadata Sidebar */}
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-[2.5rem] p-8 border border-white/5 space-y-8"
            >
              <div className="space-y-6">
                <header className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Archival Metadata</h3>
                  <Target size={16} className="text-slate-700" />
                </header>

                <div className="space-y-5">
                   <div className="group/meta">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 flex justify-between items-center px-1">
                        Archival ID
                        <Check size={10} className={cn("text-emerald-500 transition-opacity", copied ? "opacity-100" : "opacity-0")} />
                      </p>
                      <button 
                        onClick={handleCopyId}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl group-hover/meta:border-blue-500/30 transition-luxury"
                      >
                         <span className="font-mono text-xs text-slate-400 truncate pr-2">{item.id}</span>
                         <Copy size={12} className="text-slate-700 group-hover/meta:text-blue-500 transition-colors" />
                      </button>
                   </div>

                   <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <Calendar size={10} /> Ingestion Point
                        </p>
                        <p className="text-[11px] font-bold text-slate-300">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </p>
                      </div>

                      {item.totalProcessingMs && (
                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <ShieldCheck size={10} /> Processing Time
                          </p>
                          <p className="text-[11px] font-bold text-slate-300">
                            {(item.totalProcessingMs / 1000).toFixed(1)}s ARCHIVAL CYCLE
                          </p>
                        </div>
                      )}
                   </div>
                </div>
              </div>

              {/* Entity Detection HUD */}
              <div className="space-y-4 pt-8 border-t border-white/5">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Neural Entity Map</h4>
                <div className="flex flex-wrap gap-2">
                   {item.identifiedNames && item.identifiedNames.length > 0 ? (
                      item.identifiedNames.map((entity, i) => (
                        <span key={i} className="px-3 py-1.5 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-black border border-blue-500/20 transition-luxury cursor-default">
                          {entity.name} <span className="text-[9px] opacity-40 ml-1 font-bold">{entity.type.toUpperCase()}</span>
                        </span>
                      ))
                   ) : (
                      <div className="text-slate-800 text-[10px] font-black italic tracking-widest">
                        {isProcessing ? "NEURAL SCANNING..." : "SCAN COMPLETED: NO ENTITIES"}
                      </div>
                   )}
                </div>
              </div>

              {/* Tags HUD */}
              <div className="space-y-4 pt-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Archival Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                   {item.tags && item.tags.length > 0 ? (
                      item.tags.map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-900 text-slate-500 rounded-lg text-[10px] font-bold border border-white/5 hover:border-slate-700 transition-luxury">
                          #{tag.replace(/\s/g, '-')}
                        </span>
                      ))
                   ) : (
                      <div className="h-6 flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-slate-800" />
                        <div className="w-1 h-1 rounded-full bg-slate-800" />
                        <div className="w-1 h-1 rounded-full bg-slate-800" />
                      </div>
                   )}
                </div>
              </div>
            </motion.div>
            
            {/* System Status / Error Panel */}
            <AnimatePresence>
              {isError && (
                <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="p-8 rounded-[2.5rem] bg-red-500/5 border border-red-500/20 text-red-400 space-y-4 shadow-2xl shadow-red-500/5"
                >
                  <div className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest">
                    <AlertCircle size={18} /> Cycle Fault Detected
                  </div>
                  <p className="text-xs font-bold leading-relaxed opacity-80">
                    {item.errorMessage || "Unknown neural processing exception."}
                  </p>
                  <button 
                    onClick={handleRetry}
                    disabled={retrying}
                    className="w-full flex items-center justify-center gap-3 py-3.5 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-red-500 transition-luxury active:scale-95 disabled:opacity-50 shadow-xl shadow-red-500/20"
                  >
                    <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
                    {retrying ? 'Re-Calibrating...' : 'Force System Reset'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <Toaster />
    </main>
  );
}
