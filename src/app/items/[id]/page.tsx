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
  ChevronRight
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
  createdAt: string;
  processedAt?: string;
  errorMessage?: string;
}

export default function ItemDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchItem();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <p className="text-slate-500 font-medium">Analyzing Archival Data...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold">Item Not Found</h1>
          <button 
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-20">
      {/* Premium Gradient Header */}
      <div className="h-64 w-full bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        
        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-20%] right-[10%] w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="max-w-6xl mx-auto px-6 h-full flex flex-col justify-end pb-8 relative z-10">
          <button 
            onClick={() => router.push('/')}
            className="absolute top-8 left-6 flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
          >
            <div className="p-2 rounded-full bg-white/10 backdrop-blur-md group-hover:bg-white/20 transition-all">
              <ArrowLeft size={18} />
            </div>
            <span className="font-medium text-sm">Dashboard</span>
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-xl ${
                   isComplete ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                   isError ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                   'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                }`}>
                  {item.status.replace('_', ' ')}
                </span>
                {item.confidence && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 backdrop-blur-xl">
                    <ShieldCheck size={14} className="text-cyan-300" />
                    {(item.confidence * 100).toFixed(0)}% Confidence
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-sm">
                {item.title || "Processing Document..."}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-10 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Visual Preview Section */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/5 border border-slate-200 dark:border-slate-800">
               <div className="aspect-auto min-h-[400px] flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 p-4">
                  {item.id && (
                    <img 
                      src={`/api/items/${item.id}/thumbnail`} 
                      alt={item.title || "Document Preview"} 
                      className={`max-w-full h-auto rounded-xl shadow-lg transition-opacity duration-1000 ${isComplete ? 'opacity-100' : 'opacity-40 grayscale'}`}
                    />
                  )}
               </div>
            </div>

            {/* AI Insights Card */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/10 transition-all duration-700" />
              
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Target size={20} />
                Archival Intelligence
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} /> Historical Context
                  </h4>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {item.historicalContext || "Awaiting context analysis..."}
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Tag size={14} /> Collector Significance
                  </h4>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {item.collectorSignificance || "Analyzing market/historical significance..."}
                  </p>
                </div>
              </div>

              <div className="mt-10 space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} /> Clean Transcription
                </h4>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 font-mono text-sm leading-relaxed border border-slate-200/50 dark:border-slate-700/50 whitespace-pre-wrap">
                   {item.cleanedTranscription || "Transcription in progress..."}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            
            {/* Metadata Sidebar Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-4 border-slate-100 dark:border-slate-800">
                <ChevronRight size={18} className="text-blue-500" />
                Metadata
              </h3>

              <div className="space-y-4">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-medium">Archival ID</span>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                      {item.id.substring(0, 8)}...
                    </span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5"><Calendar size={14} /> Ingested</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5"><Clock size={14} /> Processed</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {item.processedAt ? formatDistanceToNow(new Date(item.processedAt), { addSuffix: true }) : 'Pending'}
                    </span>
                 </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Entities Identified</h4>
                <div className="flex flex-wrap gap-2">
                   {item.identifiedNames && item.identifiedNames.length > 0 ? (
                      item.identifiedNames.map((entity, i) => (
                        <span key={i} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold border border-blue-100 dark:border-blue-800/50">
                          {entity.name} <span className="opacity-50 ml-1">({entity.type})</span>
                        </span>
                      ))
                   ) : (
                      <span className="text-slate-400 text-sm italic">None detected</span>
                   )}
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl space-y-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-white/20 transition-all duration-500" />
              
              <h3 className="text-lg font-bold">Manage Records</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Export metadata or view the high-resolution original document for manual verification.
              </p>
              
              <div className="space-y-2 pt-2">
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-white text-blue-700 font-bold rounded-2xl hover:bg-slate-50 transition-colors shadow-lg">
                  <ExternalLink size={18} /> View Original
                </button>
                <button className="w-full py-3 bg-blue-500/20 backdrop-blur-md text-white font-bold rounded-2xl border border-white/20 hover:bg-blue-500/30 transition-colors">
                  Export PDF
                </button>
              </div>
            </div>
            
            {isError && (
              <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl p-6 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400">
                <div className="flex items-center gap-2 font-bold mb-2">
                  <AlertCircle size={18} /> Processing Error
                </div>
                <p className="text-sm opacity-80 leading-relaxed font-medium">
                  {item.errorMessage || "An unknown error occurred during archival processing."}
                </p>
                <button className="mt-4 text-xs font-bold underline underline-offset-4 uppercase tracking-widest hover:text-red-700">
                  Retry Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </main>
  );
}
