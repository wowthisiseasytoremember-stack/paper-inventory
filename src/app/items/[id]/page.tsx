"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  Tag, 
  History, 
  Target, 
  FileText, 
  ShieldCheck,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  DollarSign,
  Sparkles,
  Search,
  Maximize2,
  HelpCircle,
  MapPin,
  Building2,
  User as UserIcon,
  Layers,
  Plus,
  FolderPlus,
  X,
  Pencil,
  Save,
  Lock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { BespokeMagnifier } from '@/components/BespokeMagnifier';

interface Entity {
  name: string;
  type: string;
  confidence: number;
  historicalNote?: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
}

interface Item {
  id: string;
  status: string;
  title?: string;
  guessedId?: string;
  cleanedTranscription?: string;
  confidence?: number;
  identifiedNames?: Entity[];
  historicalContext?: string;
  collectorSignificance?: string;
  valuation?: string;
  verification_questions?: string[];
  originalImagePath?: string;
  resizedImagePath?: string;
  thumbnailPath?: string;
  tags?: string[];
  createdAt: string;
  processedAt?: string;
  errorMessage?: string;
  aiDurationMs?: number;
  totalProcessingMs?: number;
  collection_id?: string;
  lockedFields?: string[];
}

export default function ItemDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editing, setEditing] = useState<string | null>(null); // field name being edited
  const [editValue, setEditValue] = useState('');

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

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (err) {
      console.error("Failed to fetch collections", err);
    }
  };

  useEffect(() => {
    fetchItem();
    fetchCollections();
    const interval = setInterval(() => {
      if (item && !['complete', 'error'].includes(item.status)) {
        fetchItem();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, item?.status]);

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

  const handleAssignCollection = async (collectionId: string | null) => {
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: collectionId })
      });
      if (!res.ok) throw new Error('Assignment failed');
      toast.success(collectionId ? 'Added to collection' : 'Removed from collection');
      fetchItem();
      setShowCollectionModal(false);
    } catch (err) {
      toast.error('Failed to update collection');
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName })
      });
      if (!res.ok) throw new Error('Creation failed');
      const data = await res.json();
      toast.success('New collection established');
      setNewCollectionName('');
      fetchCollections();
      handleAssignCollection(data.id);
    } catch (err) {
      toast.error('Failed to create collection');
    }
  };

  const startEdit = (field: string, currentValue: string) => {
    setEditing(field);
    setEditValue(currentValue || '');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const saveEdit = async (field: string) => {
    if (!item) return;
    try {
      const payload: Record<string, any> = {};
      if (field === 'tags') {
        payload.tags = JSON.stringify(editValue.split(',').map(t => t.trim()).filter(Boolean));
      } else {
        payload[field] = editValue;
      }
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Field updated');
      setEditing(null);
      setEditValue('');
      fetchItem();
    } catch (err) {
      toast.error('Failed to save edit');
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
  const currentCollection = collections.find(c => c.id === item.collection_id);
  const displayValue = (() => {
    if (!item.valuation) return '— —';
    const likelyMatch = item.valuation.match(/(?:Most Likely|eBay Sale)[^$]*(\$[\d,]+(?:\.\d{2})?)/i);
    if (likelyMatch) return likelyMatch[1];
    const rangeMatch = item.valuation.match(/(\$[\d,]+(?:\.\d{2})?)\s*[-–]\s*(\$[\d,]+(?:\.\d{2})?)/);
    if (rangeMatch) return `${rangeMatch[1]}–${rangeMatch[2]}`;
    const firstMatch = item.valuation.match(/\$[\d,]+(?:\.\d{2})?/);
    return firstMatch ? firstMatch[0] : '— —';
  })();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 overflow-x-hidden selection:bg-blue-500/30">
      {/* Dynamic Hero Layout */}
      <div className="relative pt-12">
        {/* Background Ambience */}
        <div className="absolute top-0 inset-x-0 h-[600px] overflow-hidden pointer-events-none opacity-20">
             <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[150px] animate-pulse" />
             <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
          {/* Top Navigation & Status */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => router.push('/')}
                className="group flex items-center gap-3 transition-all"
              >
                <div className="p-3 rounded-2xl glass hover:bg-white/10 transition-luxury shadow-2xl border border-white/5 group-hover:-translate-x-1">
                  <ArrowLeft size={18} className="text-white" />
                </div>
              </button>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border shadow-2xl transition-all duration-500",
                    isComplete ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                    isError ? "bg-red-500/10 text-red-400 border-red-500/30" :
                    "bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse"
                  )}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    ID: {item.id.split('-')[0].toUpperCase()}
                  </span>
                </div>
                {editing === 'title' ? (
                  <div className="flex items-center gap-2 max-w-xl">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit('title'); if (e.key === 'Escape') cancelEdit(); }}
                      className="text-xl font-bold text-white bg-slate-900 border border-blue-500/50 rounded-xl px-3 py-1 outline-none flex-grow"
                    />
                    <button onClick={() => saveEdit('title')} className="p-1.5 bg-blue-600 rounded-lg text-white hover:bg-blue-500"><Save size={14} /></button>
                    <button onClick={cancelEdit} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:bg-slate-700"><X size={14} /></button>
                  </div>
                ) : (
                  <h1
                    className="text-xl md:text-2xl font-bold text-slate-300 truncate max-w-xl group/title cursor-pointer flex items-center gap-2"
                    onClick={() => isComplete && startEdit('title', item.title || '')}
                  >
                    {item.title || "Unidentified Record"}
                    {isComplete && <Pencil size={14} className="text-slate-700 opacity-0 group-hover/title:opacity-100 transition-opacity" />}
                    {item.lockedFields?.includes('title') && <Lock size={12} className="text-amber-500/50" />}
                  </h1>
                )}
              </div>
            </div>
          </div>

          {/* KEY METRICS (ID / CONFIDENCE / VALUE) */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-10"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass rounded-2xl px-5 py-4 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Item ID</p>
                  <p className="text-sm font-bold text-slate-200 mt-1">{item.id}</p>
                </div>
                <button
                  onClick={handleCopyId}
                  className="p-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                  aria-label="Copy item ID"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-400" />}
                </button>
              </div>

              <div className="glass rounded-2xl px-5 py-4 border border-white/10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence</p>
                <p className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-2">
                  <ShieldCheck className="text-blue-400 w-4 h-4" />
                  {((item.confidence || 0.85) * 100).toFixed(0)}%
                </p>
              </div>

              <div className="glass rounded-2xl px-5 py-4 border border-white/10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Value</p>
                <p className="text-2xl font-black text-white tracking-tight tabular-nums mt-1">{displayValue}</p>
              </div>
            </div>
          </motion.div>

          {/* ERROR CALLOUT */}
          {isError && item.errorMessage && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mb-8 p-8 rounded-[2rem] bg-red-500/5 border border-red-500/20 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-red-400 font-black text-xs uppercase tracking-widest">
                  <AlertCircle size={18} /> Processing Failed
                </div>
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex items-center gap-2 px-5 py-2 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
                  {retrying ? 'RETRYING...' : 'RETRY'}
                </button>
              </div>
              <p className="text-sm text-red-300/80 font-mono leading-relaxed break-all">
                {item.errorMessage}
              </p>
            </motion.div>
          )}

          {/* VALUATION DASHBOARD (High Visibility) */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-12 relative group"
          >
             <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[3rem] blur opacity-10 group-hover:opacity-20 transition duration-1000" />
             <div className="relative glass rounded-[3rem] p-10 md:p-12 border border-white/10 shadow-3xl bg-slate-900/40 backdrop-blur-3xl overflow-hidden">
                <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
                   <DollarSign size={300} strokeWidth={0.5} />
                </div>

                <div className="grid grid-cols-1 lg:items-center gap-8">
                   <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                           <div className="w-10 h-[1px] bg-emerald-500/50" />
                           <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.4em]">Expert Market Appraisal</p>
                        </div>
                        <h2 className="text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter tabular-nums leading-none">
                           {displayValue}
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-6 pt-4">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</p>
                            <p className="text-sm font-bold text-white flex items-center gap-2">
                               {item.valuation ? (
                                 <><Check className="text-emerald-500 w-4 h-4" /> APPRAISED</>
                               ) : isComplete ? (
                                 <><Clock className="text-amber-400 w-4 h-4" /> AUTO APPRAISAL</>
                               ) : isError ? (
                                 <><AlertCircle className="text-red-400 w-4 h-4" /> ERROR</>
                               ) : (
                                 <><RefreshCw className="text-blue-400 w-4 h-4 animate-spin" /> PROCESSING</>
                               )}
                            </p>
                         </div>
                         <div className="w-[1px] h-10 bg-white/10" />
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence Score</p>
                            <p className="text-sm font-bold text-white uppercase flex items-center gap-2">
                              <ShieldCheck className="text-blue-400 w-4 h-4" /> {((item.confidence || 0.85) * 100).toFixed(0)}% ANALYTIC
                            </p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </motion.div>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* LEFT COLUMN: Visuals (4 cols) */}
            <div className="lg:col-span-4 space-y-8 sticky top-12">
               <motion.div 
                 initial={{ scale: 0.95, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="group relative glass rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 p-2 bg-slate-900/50"
               >
                  <div className="aspect-[4/5] md:aspect-square lg:aspect-[4/5] relative rounded-[2.1rem] overflow-hidden bg-slate-950 flex items-center justify-center group-hover:shadow-[0_0_50px_rgba(59,130,246,0.1)] transition-all duration-700">
                     {!imageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                           <RefreshCw className="w-8 h-8 text-slate-800 animate-spin" />
                        </div>
                     )}
                     
                     <BespokeMagnifier 
                        src={`/api/items/${item.id}/image`}
                        alt={item.title || "Archive"}
                        className={cn(
                           "max-w-full h-full object-contain transition-all duration-1000 group-hover:scale-105",
                           imageLoaded ? "opacity-100" : "opacity-0"
                        )}
                        onLoad={() => setImageLoaded(true)}
                     />

                     <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 pointer-events-none" />
                  </div>
               </motion.div>

               {/* VERIFICATION QUESTIONS */}
               {item.verification_questions && item.verification_questions.length > 0 && (
                 <motion.div 
                   initial={{ x: -20, opacity: 0 }}
                   animate={{ x: 0, opacity: 1 }}
                   className="p-8 rounded-[2rem] bg-amber-500/5 border border-amber-500/20 shadow-xl space-y-4"
                 >
                   <div className="flex items-center gap-3 text-amber-500 font-black text-xs uppercase tracking-widest">
                     <HelpCircle size={18} /> Verification Needed
                   </div>
                   <p className="text-[11px] font-bold text-amber-200/60 leading-relaxed uppercase tracking-wider">
                     The specialist requires clarification on the following to finalize valuation:
                   </p>
                   <ul className="space-y-3">
                      {item.verification_questions.map((q, i) => (
                        <li key={i} className="flex gap-3 text-sm font-semibold text-slate-300 group/q">
                           <span className="text-amber-500/50 mt-1">•</span>
                           <span>{q}</span>
                        </li>
                      ))}
                   </ul>
                 </motion.div>
               )}

               {/* QUICK METADATA */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="glass bg-white/5 rounded-2xl p-5 border border-white/5 space-y-2">
                     <div className="flex items-center gap-2 text-slate-500">
                        <Calendar size={12} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Archived</span>
                     </div>
                     <p className="text-xs font-bold text-slate-300">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                     </p>
                  </div>
                  <div className="glass bg-white/5 rounded-2xl p-5 border border-white/5 space-y-2">
                     <div className="flex items-center gap-2 text-slate-500">
                        <Clock size={12} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Runtime</span>
                     </div>
                     <p className="text-xs font-bold text-slate-300">
                        {(item.totalProcessingMs || 0) / 1000}s CYCLE
                     </p>
                  </div>
               </div>
            </div>

            {/* RIGHT COLUMN: Intelligence (8 cols) */}
            <div className="lg:col-span-8 space-y-12">
               
               {/* HISTORICAL NARRATIVE */}
               <motion.section 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.2 }}
                 className="space-y-8"
               >
                  <div className="flex items-center gap-4">
                     <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                     <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] flex items-center gap-2">
                       Historical Research
                       {item.lockedFields?.includes('historicalContext') && <Lock size={10} className="text-amber-500/50" />}
                     </h3>
                     <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                     {isComplete && editing !== 'historicalContext' && item.historicalContext && (
                       <button
                         onClick={() => startEdit('historicalContext', item.historicalContext || '')}
                         className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-400 flex items-center gap-1 transition-colors"
                       >
                         <Pencil size={10} /> Edit
                       </button>
                     )}
                  </div>

                  {editing === 'historicalContext' ? (
                    <div className="space-y-3">
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full glass bg-slate-950/80 rounded-[2.5rem] p-10 border border-blue-500/30 text-sm text-slate-300 leading-[1.8] outline-none resize-none min-h-[300px]"
                      />
                      <p className="text-[10px] text-slate-600">Supports Markdown formatting</p>
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEdit} className="px-4 py-2 bg-slate-800 text-slate-400 text-[10px] font-black rounded-xl uppercase tracking-widest">Cancel</button>
                        <button onClick={() => saveEdit('historicalContext')} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest"><Save size={12} className="inline mr-1" />Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-blue max-w-none prose-p:text-slate-400 prose-p:leading-[1.8] prose-p:text-lg prose-headings:text-white prose-strong:text-blue-400 prose-li:text-slate-400">
                       {item.historicalContext ? (
                          <ReactMarkdown>{item.historicalContext}</ReactMarkdown>
                       ) : (
                          <div className="flex flex-col items-center justify-center p-20 glass bg-white/5 rounded-[3rem] border border-dashed border-white/10 opacity-50">
                             <History className="w-12 h-12 text-slate-700 mb-4" />
                             <p className="text-sm font-black uppercase tracking-widest text-slate-600">Narrative Pending Deep Dive</p>
                          </div>
                       )}
                    </div>
                  )}
               </motion.section>

               {/* PRICING STRATEGY (MOVED DOWN) */}
               <motion.section
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.25 }}
                 className="glass rounded-[2.5rem] p-10 border border-white/10 bg-white/5 space-y-4"
               >
                  <div className="flex items-center gap-2 text-slate-300">
                     <Target size={18} className="text-indigo-400" />
                     <span className="text-xs font-black uppercase tracking-widest">Pricing Strategy</span>
                  </div>
                  <div className="text-slate-400 text-sm font-medium leading-relaxed prose prose-invert prose-blue prose-p:mb-0 prose-strong:text-emerald-400">
                     <ReactMarkdown>
                       {item.valuation?.includes('**') ? item.valuation : "Auto appraisals run after ingest. Refresh later for the detailed pricing logic."}
                     </ReactMarkdown>
                  </div>
                  {isComplete && (
                    <div className="flex gap-2 pt-2">
                       {item.tags?.slice(0, 3).map(tag => (
                         <span key={tag} className="text-[9px] font-black px-3 py-1 bg-white/5 border border-white/5 rounded-full text-slate-500 uppercase tracking-widest">
                           #{tag}
                         </span>
                       ))}
                    </div>
                  )}
               </motion.section>

               {/* SIGNIFICANCE & MARKET POSITION */}
               <motion.section 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8"
               >
                  <div className="glass rounded-[2.5rem] p-10 border border-white/10 bg-indigo-500/5 shadow-xl space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-indigo-400">
                           <Sparkles size={20} />
                           <h4 className="text-sm font-black uppercase tracking-widest">Collector Significance</h4>
                           {item.lockedFields?.includes('collectorSignificance') && <Lock size={10} className="text-amber-500/50" />}
                        </div>
                        {isComplete && editing !== 'collectorSignificance' && item.collectorSignificance && (
                          <button
                            onClick={() => startEdit('collectorSignificance', item.collectorSignificance || '')}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                          >
                            <Pencil size={10} /> Edit
                          </button>
                        )}
                     </div>
                     {editing === 'collectorSignificance' ? (
                       <div className="space-y-3">
                         <textarea
                           autoFocus
                           value={editValue}
                           onChange={(e) => setEditValue(e.target.value)}
                           className="w-full bg-slate-950 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 leading-[1.7] outline-none resize-none min-h-[150px]"
                         />
                         <div className="flex gap-2 justify-end">
                           <button onClick={cancelEdit} className="px-4 py-2 bg-slate-800 text-slate-400 text-[10px] font-black rounded-xl uppercase tracking-widest">Cancel</button>
                           <button onClick={() => saveEdit('collectorSignificance')} className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest"><Save size={12} className="inline mr-1" />Save</button>
                         </div>
                       </div>
                     ) : (
                       <div className="text-slate-400 text-sm font-medium leading-[1.7] prose prose-invert prose-indigo prose-p:mb-0">
                          {item.collectorSignificance ? (
                             <ReactMarkdown>{item.collectorSignificance}</ReactMarkdown>
                          ) : (
                             <p>Establishing rarity fingerprints and niche market demand patterns...</p>
                          )}
                       </div>
                     )}
                  </div>

                  <div className="glass rounded-[2.5rem] p-10 border border-white/10 space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-blue-400">
                           <Layers size={20} />
                           <h4 className="text-sm font-black uppercase tracking-widest">Niche Categorization</h4>
                           {item.lockedFields?.includes('tags') && <Lock size={10} className="text-amber-500/50" />}
                        </div>
                        {isComplete && editing !== 'tags' && (
                          <button
                            onClick={() => startEdit('tags', (item.tags || []).join(', '))}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-400 flex items-center gap-1 transition-colors"
                          >
                            <Pencil size={10} /> Edit
                          </button>
                        )}
                     </div>
                     {editing === 'tags' ? (
                       <div className="space-y-3">
                         <input
                           autoFocus
                           value={editValue}
                           onChange={(e) => setEditValue(e.target.value)}
                           onKeyDown={(e) => { if (e.key === 'Enter') saveEdit('tags'); if (e.key === 'Escape') cancelEdit(); }}
                           placeholder="tag1, tag2, tag3..."
                           className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 outline-none focus:border-blue-500"
                         />
                         <p className="text-[10px] text-slate-600">Separate tags with commas</p>
                         <div className="flex gap-2 justify-end">
                           <button onClick={cancelEdit} className="px-4 py-2 bg-slate-800 text-slate-400 text-[10px] font-black rounded-xl uppercase tracking-widest">Cancel</button>
                           <button onClick={() => saveEdit('tags')} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest"><Save size={12} className="inline mr-1" />Save</button>
                         </div>
                       </div>
                     ) : (
                       <div className="flex flex-wrap gap-2">
                           {item.tags?.map((tag, i) => (
                             <span key={i} className="px-4 py-2 bg-slate-900 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-400 hover:border-blue-400/30 transition-all cursor-default">
                                {tag}
                             </span>
                           ))}
                           {(!item.tags || item.tags.length === 0) && (
                             <p className="text-slate-700 text-[10px] font-black uppercase italic">No tags assigned</p>
                           )}
                       </div>
                     )}
                     <div className="pt-4 border-t border-white/5">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Portfolio Management</p>
                        {currentCollection ? (
                          <div 
                            onClick={() => setShowCollectionModal(true)}
                            className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-2xl border border-blue-500/30 hover:border-blue-400 transition-all cursor-pointer group"
                          >
                             <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:rotate-12 transition-transform">
                                <Tag size={14} />
                             </div>
                             <span className="text-[11px] font-black text-blue-300 uppercase tracking-widest truncate">{currentCollection.name}</span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setShowCollectionModal(true)}
                            className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-dashed border-white/10 hover:border-slate-500 transition-all text-slate-600 hover:text-slate-400 w-full group"
                          >
                             <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-slate-700">
                                <Plus size={14} />
                             </div>
                             <span className="text-[10px] font-black uppercase tracking-widest">Add to Collection</span>
                          </button>
                        )}
                     </div>
                  </div>
               </motion.section>

               {/* ENTITY MAP & TRANSCRIPTION */}
               <motion.section 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-6"
               >
                  <div className="flex items-center justify-between">
                     <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        Neural Transcription & Entities
                        {item.lockedFields?.includes('cleanedTranscription') && <Lock size={10} className="text-amber-500/50" />}
                     </h3>
                     <div className="flex items-center gap-3">
                        {isComplete && editing !== 'cleanedTranscription' && (
                          <button
                            onClick={() => startEdit('cleanedTranscription', item.cleanedTranscription || '')}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-400 flex items-center gap-1 transition-colors"
                          >
                            <Pencil size={10} /> Edit
                          </button>
                        )}
                        <button
                           onClick={() => {
                              navigator.clipboard.writeText(item.cleanedTranscription || '');
                              toast.success('System: Digital record copied');
                           }}
                           className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white flex items-center gap-2 transition-colors"
                        >
                           <Copy size={12} /> Copy Tape
                        </button>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {editing === 'cleanedTranscription' ? (
                       <div className="md:col-span-2 space-y-3">
                         <textarea
                           autoFocus
                           value={editValue}
                           onChange={(e) => setEditValue(e.target.value)}
                           className="w-full glass bg-slate-950/80 rounded-[2.5rem] p-10 border border-blue-500/30 font-mono text-sm text-slate-300 leading-[1.8] max-h-[400px] overflow-y-auto custom-scrollbar outline-none resize-none min-h-[200px]"
                         />
                         <div className="flex gap-2 justify-end">
                           <button onClick={cancelEdit} className="px-4 py-2 bg-slate-800 text-slate-400 text-[10px] font-black rounded-xl uppercase tracking-widest">Cancel</button>
                           <button onClick={() => saveEdit('cleanedTranscription')} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest"><Save size={12} className="inline mr-1" />Save</button>
                         </div>
                       </div>
                     ) : (
                       <div className="md:col-span-2 glass bg-slate-950/80 rounded-[2.5rem] p-10 border border-white/5 font-mono text-sm text-slate-400 selection:bg-blue-500/40 leading-[1.8] max-h-[400px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                          {item.cleanedTranscription || "Initiating digital reconstruction..."}
                       </div>
                     )}
                     <div className="space-y-4">
                        <div className="p-8 glass rounded-[2rem] border border-white/5 space-y-6">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detected Entities</p>
                           <div className="space-y-3">
                              {item.identifiedNames?.map((entity, i) => (
                                <div key={i} className="group/entity space-y-1">
                                   <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-black text-blue-400 truncate max-w-[120px]">{entity.name.toUpperCase()}</span>
                                      <span className="text-[9px] font-bold text-slate-700 uppercase tracking-tighter">{entity.type}</span>
                                   </div>
                                    {entity.historicalNote && (
                                       <p className="text-[10px] text-slate-600 italic font-medium leading-tight group-hover/entity:text-slate-500 transition-colors">
                                          {entity.historicalNote}
                                       </p>
                                    )}
                                </div>
                              ))}
                              {!item.identifiedNames?.length && <p className="text-slate-800 text-[10px] font-black uppercase italic">No entities flagged</p>}
                           </div>
                        </div>
                     </div>
                  </div>
               </motion.section>
            </div>
          </div>
        </div>
      </div>

      {/* COLLECTION MODAL */}
      <AnimatePresence>
         {showCollectionModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
               <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCollectionModal(false)}
                  className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
               />
               <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative glass bg-slate-900 w-full max-w-lg rounded-[3rem] border border-white/10 shadow-3xl p-8 md:p-12 space-y-8"
               >
                  <div className="flex items-center justify-between">
                     <h3 className="text-xl font-bold text-white">Manage Collection</h3>
                     <button onClick={() => setShowCollectionModal(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <X size={20} />
                     </button>
                  </div>

                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Existing Collections</p>
                     <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {collections.map(c => (
                           <button 
                             key={c.id}
                             onClick={() => handleAssignCollection(c.id)}
                             className={cn(
                               "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                               item.collection_id === c.id ? "bg-blue-600 border-blue-400 text-white" : "bg-white/5 border-white/5 hover:border-white/20 text-slate-300"
                             )}
                           >
                              <span className="text-sm font-bold uppercase tracking-widest">{c.name}</span>
                              {item.collection_id === c.id && <Check size={16} />}
                           </button>
                        ))}
                        {item.collection_id && (
                          <button 
                            onClick={() => handleAssignCollection(null)}
                            className="p-4 rounded-2xl border border-dashed border-red-500/20 text-red-400 hover:bg-red-500/5 text-xs font-black uppercase tracking-widest"
                          >
                             Remove from collection
                          </button>
                        )}
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Create New Collection</p>
                     <div className="flex gap-2">
                        <input 
                           type="text" 
                           value={newCollectionName}
                           onChange={(e) => setNewCollectionName(e.target.value)}
                           placeholder="e.g. Civil War Corresp..."
                           className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:border-blue-500 outline-none transition-all"
                        />
                        <button 
                           onClick={handleCreateCollection}
                           className="p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                           <FolderPlus size={18} />
                        </button>
                     </div>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
      
      {/* HUD Bar (Floating Bottom) */}
      <AnimatePresence>
         {isComplete && (
            <motion.div 
               initial={{ y: 100 }}
               animate={{ y: 0 }}
               className="fixed bottom-8 inset-x-0 z-50 px-6 flex justify-center"
            >
               <div className="glass bg-slate-900/80 backdrop-blur-3xl px-8 py-4 rounded-[2.5rem] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex items-center gap-8">
                  <div className="hidden md:flex flex-col">
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Valuation Engine</span>
                     <span className="text-xs font-bold text-emerald-400 uppercase">Analytic Research Hub</span>
                  </div>
                  <div className="h-8 w-[1px] bg-white/10 hidden md:block" />
                  <div className="flex items-center gap-3">
                     <button
                        onClick={() => {
                           navigator.clipboard.writeText(JSON.stringify({
                             id: item.id, title: item.title, valuation: item.valuation,
                             tags: item.tags, historicalContext: item.historicalContext,
                           }, null, 2));
                           toast.success('Item data copied to clipboard');
                        }}
                        className="hidden sm:flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-[11px] font-black text-slate-300 transition-all border border-white/5 active:scale-95"
                     >
                        <Copy size={14} className="text-emerald-500" /> COPY DATA
                     </button>
                     <button
                        onClick={() => {
                           const listing = [
                             item.title || 'Untitled Item',
                             '',
                             item.historicalContext || '',
                             '',
                             item.collectorSignificance ? `COLLECTOR NOTE: ${item.collectorSignificance}` : '',
                             '',
                             item.valuation ? `PRICING: ${item.valuation}` : '',
                             '',
                             item.tags?.length ? `Tags: ${item.tags.join(', ')}` : '',
                           ].filter(Boolean).join('\n');
                           navigator.clipboard.writeText(listing);
                           toast.success('eBay listing draft copied to clipboard');
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                     >
                        <ExternalLink size={14} /> EBAY TEMPLATE
                     </button>
                  </div>
               </div>
            </motion.div>
         )}
      </AnimatePresence>

    </main>
  );
}
