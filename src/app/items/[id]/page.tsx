"use client";

import { useEffect, useState } from 'react';
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
  Check
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Toaster } from '@/components/ui/toaster';
import { toast } from 'sonner';

interface Entity {
  name: string;
  type: string;
  confidence: number;
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
  originalImagePath?: string;
  resizedImagePath?: string;
  thumbnailPath?: string;
  tags?: string[];
  createdAt: string;
  processedAt?: string;
  errorMessage?: string;
  aiDurationMs?: number;
  totalProcessingMs?: number;
}

export default function ItemDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchItem = async () => {
    try {
      const res = await fetch(`/api/items/${id}`);
      if (!res.ok) throw new Error('Failed to fetch item');
      const data = await res.json();
      setItem(data);
    } catch (err) {
      console.error(err);
      toast.error('Could not load item details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItem();
    // Poll while processing
    const interval = setInterval(() => {
      if (item && !['complete', 'error'].includes(item.status)) {
        fetchItem();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/items/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Re-queued for processing');
      fetchItem();
    } catch (err: any) {
      toast.error(err.message || 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(item?.id || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Item Not Found</h1>
          <button 
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';
  const isProcessing = !isComplete && !isError;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      {/* Gradient Header */}
      <div className="h-48 md:h-56 w-full bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        
        {/* Ambient Orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-48 h-48 bg-cyan-400/15 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[10%] w-64 h-64 bg-fuchsia-500/15 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto px-4 h-full flex flex-col justify-end pb-6 relative z-10">
          <button 
            onClick={() => router.push('/')}
            className="absolute top-4 left-4 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <div className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all">
              <ArrowLeft size={16} />
            </div>
          </button>
          
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-xl ${
                 isComplete ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                 isError ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse'
              }`}>
                {item.status.replace(/_/g, ' ')}
              </span>
              {item.confidence != null && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/20 backdrop-blur-xl">
                  <ShieldCheck size={12} className="text-cyan-300" />
                  {(item.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {item.title || (isProcessing ? "Processing..." : "Untitled Document")}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Image Preview */}
            <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800">
               <div className="aspect-auto min-h-[250px] md:min-h-[350px] flex items-center justify-center bg-slate-800/50 p-3">
                  {item.id && (
                    <img 
                      src={`/api/items/${item.id}/image`} 
                      alt={item.title || "Document Preview"} 
                      className={`max-w-full h-auto rounded-xl shadow-lg transition-opacity duration-500 ${isComplete ? 'opacity-100' : 'opacity-40 grayscale'}`}
                    />
                  )}
               </div>
            </div>

            {/* AI Insights */}
            <div className="bg-slate-900 rounded-2xl p-5 md:p-6 border border-slate-800 space-y-6">
              <h3 className="text-base font-bold flex items-center gap-2 text-blue-400">
                <Target size={18} />
                Archival Intelligence
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <History size={12} /> Historical Context
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {item.historicalContext || (isProcessing ? "Analyzing..." : "No context detected.")}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Tag size={12} /> Collector Significance
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {item.collectorSignificance || (isProcessing ? "Analyzing..." : "No significance detected.")}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag, i) => (
                    <span key={i} className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg text-[10px] font-semibold border border-slate-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText size={12} /> Transcription
                </h4>
                <div className="bg-slate-800/50 rounded-xl p-4 font-mono text-xs leading-relaxed border border-slate-700/50 whitespace-pre-wrap text-slate-300 max-h-80 overflow-y-auto">
                   {item.cleanedTranscription || (isProcessing ? "Transcribing..." : "No text extracted.")}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            
            {/* Metadata */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 border-b pb-3 border-slate-800">
                <ChevronRight size={16} className="text-blue-500" />
                Metadata
              </h3>

              <div className="space-y-3 text-xs">
                 <div className="flex justify-between items-center">
                    <span className="text-slate-500">Archival ID</span>
                    <button onClick={handleCopyId} className="flex items-center gap-1 font-mono bg-slate-800 px-2 py-1 rounded text-slate-400 hover:text-white transition-colors">
                      {item.id.substring(0, 8)}...
                      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    </button>
                 </div>
                 {item.guessedId && (
                   <div className="flex justify-between items-center">
                     <span className="text-slate-500">Document ID</span>
                     <span className="text-slate-300 font-semibold">{item.guessedId}</span>
                   </div>
                 )}
                 <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center gap-1"><Calendar size={12} /> Ingested</span>
                    <span className="text-slate-300 font-semibold">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center gap-1"><Clock size={12} /> Processed</span>
                    <span className="text-slate-300 font-semibold">
                      {item.processedAt ? formatDistanceToNow(new Date(item.processedAt), { addSuffix: true }) : 'Pending'}
                    </span>
                 </div>
                 {item.totalProcessingMs && (
                   <div className="flex justify-between items-center">
                     <span className="text-slate-500">Duration</span>
                     <span className="text-slate-300 font-semibold">{(item.totalProcessingMs / 1000).toFixed(1)}s</span>
                   </div>
                 )}
              </div>

              {/* Entities */}
              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Entities</h4>
                <div className="flex flex-wrap gap-1.5">
                   {item.identifiedNames && item.identifiedNames.length > 0 ? (
                      item.identifiedNames.map((entity, i) => (
                        <span key={i} className="px-2.5 py-1 bg-blue-900/20 text-blue-400 rounded-lg text-[10px] font-bold border border-blue-800/30">
                          {entity.name} <span className="opacity-50">({entity.type})</span>
                        </span>
                      ))
                   ) : (
                      <span className="text-slate-600 text-xs italic">
                        {isProcessing ? "Detecting..." : "None found"}
                      </span>
                   )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gradient-to-br from-indigo-600/80 to-blue-700/80 rounded-2xl p-5 text-white border border-indigo-500/20 space-y-3">
              <h3 className="text-sm font-bold">Actions</h3>
              
              <button 
                onClick={() => window.open(`/api/items/${item.id}/image`, '_blank')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-blue-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors active:scale-[0.98]"
              >
                <ExternalLink size={16} /> View Original
              </button>
            </div>
            
            {/* Error State */}
            {isError && (
              <div className="bg-red-900/10 rounded-2xl p-5 border border-red-900/30 text-red-400">
                <div className="flex items-center gap-2 font-bold text-sm mb-2">
                  <AlertCircle size={16} /> Processing Error
                </div>
                <p className="text-xs opacity-80 leading-relaxed mb-4">
                  {item.errorMessage || "An unknown error occurred."}
                </p>
                <button 
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
                  {retrying ? 'Retrying...' : 'Retry Analysis'}
                </button>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="bg-blue-900/10 rounded-2xl p-5 border border-blue-900/30 text-blue-400">
                <div className="flex items-center gap-2 text-sm font-bold mb-2">
                  <RefreshCw size={14} className="animate-spin" /> Processing
                </div>
                <p className="text-xs opacity-80 leading-relaxed">
                  This document is being processed. The page will update automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </main>
  );
}
