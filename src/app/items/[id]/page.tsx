"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, AlertCircle, RefreshCw, Copy, Check, Pencil, Save, X,
  Lock, ChevronDown, Tag, Plus, FolderPlus, HelpCircle, ExternalLink
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

// ---- Helpers ----

function extractPrice(valuation?: string): string | null {
  if (!valuation) return null;
  const likely = valuation.match(/(?:Most Likely|Likely)[^$]*(\$[\d,]+(?:\.\d{2})?)/i);
  if (likely) return likely[1];
  const range = valuation.match(/(\$[\d,]+(?:\.\d{2})?)\s*[-–]\s*(\$[\d,]+(?:\.\d{2})?)/);
  if (range) return `${range[1]}–${range[2]}`;
  const first = valuation.match(/\$[\d,]+(?:\.\d{2})?/);
  return first ? first[0] : null;
}

// ---- Inline Edit Hook ----

function useInlineEdit(itemId: string, onSaved: () => void) {
  const [field, setField] = useState<string | null>(null);
  const [value, setValue] = useState('');

  const start = (f: string, current: string) => { setField(f); setValue(current || ''); };
  const cancel = () => { setField(null); setValue(''); };

  const save = async () => {
    if (!field) return;
    const payload: Record<string, string> = {};
    if (field === 'tags') {
      payload.tags = JSON.stringify(value.split(',').map(t => t.trim()).filter(Boolean));
    } else {
      payload[field] = value;
    }
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Updated');
      cancel();
      onSaved();
    } catch { toast.error('Failed to save'); }
  };

  return { field, value, setValue, start, cancel, save };
}

// ---- Sub-components ----

function EditableText({ label, fieldName, content, locked, editable, edit, multiline = false }: {
  label: string; fieldName: string; content?: string; locked?: boolean; editable: boolean;
  edit: ReturnType<typeof useInlineEdit>; multiline?: boolean;
}) {
  const isEditing = edit.field === fieldName;

  if (isEditing) {
    return (
      <div className="space-y-3">
        {multiline ? (
          <textarea autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
            className="w-full bg-slate-900 border border-blue-500/50 rounded-2xl px-5 py-4 text-sm text-slate-200 leading-relaxed outline-none resize-none min-h-[160px] shadow-inner shadow-black/50 transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50" />
        ) : (
          <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') edit.save(); if (e.key === 'Escape') edit.cancel(); }}
            className="w-full bg-slate-900 border border-blue-500/50 rounded-xl px-5 py-3 text-sm text-slate-200 outline-none shadow-inner shadow-black/50 transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50" />
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={edit.cancel} className="px-4 py-2 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl transition-colors">Cancel</button>
          <button onClick={edit.save} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-500/20"><Save size={14} />Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/field relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          {label}
          {locked && <Lock size={12} className="text-amber-500/60" />}
        </h3>
        {editable && content && !locked && (
          <button onClick={() => edit.start(fieldName, content)}
            className="text-xs font-bold text-slate-500 hover:text-blue-400 flex items-center gap-1.5 opacity-0 group-hover/field:opacity-100 transition-all bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 hover:border-blue-500/30">
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
      {content ? (
        <div className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-p:my-2 prose-strong:text-white max-w-none font-medium">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-slate-600 font-medium italic">Pending analysis...</p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config = status === 'complete'
    ? { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Complete' }
    : status === 'error'
    ? { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: 'Error' }
    : { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20 animate-pulse', label: status.replace(/_/g, ' ') };
  return (
    <span className={cn('px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border', config.bg, config.text, config.border)}>
      {config.label}
    </span>
  );
}

// ---- Main Page ----

export default function ItemDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const fetchItem = async () => {
    try {
      const res = await fetch(`/api/items/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      setItem(await res.json());
    } catch { toast.error('Could not load item'); }
    finally { setLoading(false); }
  };

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      if (res.ok) setCollections(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchItem();
    fetchCollections();
    // Live Polling
    const interval = setInterval(() => {
      // Re-fetch item to update visual state while not complete or error
      if (item && !['complete', 'error'].includes(item.status)) fetchItem();
    }, 2000);
    return () => clearInterval(interval);
  }, [id, item?.status]);

  const edit = useInlineEdit(id as string, fetchItem);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/items/${id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Re-queued for processing');
      fetchItem();
    } catch (err: any) { toast.error(err.message); }
    finally { setRetrying(false); }
  };

  const handleAssignCollection = async (collectionId: string | null) => {
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: collectionId }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(collectionId ? 'Added to collection' : 'Removed');
      fetchItem();
      setShowCollectionModal(false);
    } catch { toast.error('Failed to update collection'); }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const res = await fetch('/api/collections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setNewCollectionName('');
      fetchCollections();
      handleAssignCollection(data.id);
    } catch { toast.error('Failed to create collection'); }
  };

  // --- Loading / Error states ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0D13]">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  function Loader2({ className }: { className?: string }) {
    return <RefreshCw className={className} />;
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0D13] p-6">
        <div className="max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)]">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Item not found</h1>
          <button onClick={() => router.push('/')} className="px-8 py-3.5 bg-white text-black text-sm font-bold rounded-2xl hover:scale-105 transition-transform">
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';
  const isProcessing = !isComplete && !isError;
  const price = extractPrice(item.valuation);
  const currentCollection = collections.find(c => c.id === item.collection_id);
  const isLocked = (f: string) => item.lockedFields?.includes(f) ?? false;

  // Visual State classes based on item status
  const visualStateClasses = cn(
    "w-full h-full object-contain transition-all duration-1000 ease-in-out",
    !imageLoaded ? "opacity-0 scale-95" : "opacity-100 scale-100",
    ['queued', 'processing_ocr', 'processing_resize'].includes(item.status)
      ? "grayscale blur-[2px]"
      : item.status === 'processing_ai'
        ? "grayscale-0 saturate-50 opacity-80"
        : "saturate-150 contrast-110"
  );

  return (
    <main className="min-h-screen bg-[#0B0D13] text-slate-200 pb-32 font-sans selection:bg-blue-500/30 selection:text-white">
      
      {/* ===== GLOBAL HEADER ===== */}
      <header className="sticky top-0 z-40 bg-[#0B0D13]/80 backdrop-blur-2xl border-b border-white/5 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all shadow-sm">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <StatusPill status={item.status} />
            {item.guessedId && (
              <span className="text-[11px] font-mono text-slate-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md">
                {item.guessedId}
              </span>
            )}
          </div>
        </div>
        
        {isComplete && (
          <div className="flex items-center gap-3">
            <button onClick={() => {
              navigator.clipboard.writeText(JSON.stringify({
                id: item.id, title: item.title, valuation: item.valuation,
                tags: item.tags, historicalContext: item.historicalContext,
              }, null, 2));
              toast.success('System Data Copied');
            }}
              className="px-4 py-2 hover:bg-white/5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <Copy size={14} /> Data
            </button>
            <button onClick={() => {
              const listing = [
                item.title || 'Untitled', '', item.historicalContext || '', '',
                item.collectorSignificance ? `${item.collectorSignificance}` : '', '',
                item.valuation ? `PRICE EVALUATION: ${item.valuation}` : '', '',
                item.tags?.length ? `Tags: ${item.tags.join(', ')}` : '',
              ].filter(Boolean).join('\n');
              navigator.clipboard.writeText(listing);
              toast.success('Listing Copied');
            }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black tracking-wide rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 flex items-center gap-2">
              <ExternalLink size={14} /> Export Listing
            </button>
          </div>
        )}
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 pt-8">
        
        {/* ===== ERROR BANNER ===== */}
        {isError && item.errorMessage && (
          <div className="mb-8 p-6 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-6 backdrop-blur-md shadow-2xl shadow-red-500/5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-3 bg-red-500/20 rounded-2xl">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-red-400 font-black tracking-tight text-lg mb-1">Processing Failed</h3>
                <p className="text-sm text-red-300/80 font-mono break-all">{item.errorMessage}</p>
              </div>
            </div>
            <button onClick={handleRetry} disabled={retrying}
              className="shrink-0 flex items-center gap-2 px-6 py-3 bg-red-500 text-white text-sm font-black rounded-xl hover:bg-red-600 disabled:opacity-50 transition-all shadow-lg shadow-red-500/20">
              <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Retrying' : 'Retry Processing'}
            </button>
          </div>
        )}

        {/* ===== MAIN SPLIT LAYOUT ===== */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-10 items-start">
          
          {/* --- LEFT COLUMN: Focus Image --- */}
          <div className="xl:sticky xl:top-28 space-y-6">
            
            <div className="relative group rounded-[2rem] overflow-hidden bg-[#0F111A] border border-white/5 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="aspect-[3/4] lg:aspect-square relative flex items-center justify-center p-4">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-slate-700 animate-spin" />
                  </div>
                )}
                {/* Visual state effects apply to the image wrapper or image itself */}
                <div className="w-full h-full relative z-0">
                  <BespokeMagnifier
                    src={`/api/items/${item.id}/image`}
                    alt={item.title || 'Item image'}
                    className={visualStateClasses}
                    onLoad={() => setImageLoaded(true)}
                  />
                </div>
                
                {/* Floating Processing Overlay (if analyzing) */}
                {isProcessing && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0B0D13]/60 backdrop-blur-md transition-opacity">
                    <div className="w-16 h-16 relative flex items-center justify-center mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin"></div>
                      <RefreshCw size={24} className="text-blue-400 animate-pulse" />
                    </div>
                    <div className="px-6 py-2 bg-black/50 rounded-full border border-white/10 backdrop-blur-xl">
                      <p className="text-sm font-black text-white tracking-widest uppercase">
                        {item.status.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats Metadata Row */}
            <div className="flex gap-4">
              <div className="flex-1 py-4 px-6 rounded-2xl bg-[#0F111A] border border-white/5 flex flex-col justify-center items-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Confidence</p>
                <p className="text-2xl font-black text-white">{((item.confidence || 0) * 100).toFixed(0)}<span className="text-slate-500 text-lg">%</span></p>
              </div>
              <div className="flex-1 py-4 px-6 rounded-2xl bg-[#0F111A] border border-white/5 flex flex-col justify-center items-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Processed</p>
                <p className="text-sm font-bold text-slate-300 mt-1">
                  {item.processedAt ? formatDistanceToNow(new Date(item.processedAt), { addSuffix: true }) : '—'}
                </p>
              </div>
            </div>

            {/* Collection Assign button */}
            <button onClick={() => setShowCollectionModal(true)}
              className={cn(
                'w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border transition-all duration-300 font-bold',
                currentCollection
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                  : 'bg-[#0F111A] border-white/5 text-slate-400 hover:text-white hover:border-white/10'
              )}>
              {currentCollection ? <Tag size={18} /> : <Plus size={18} />}
              <span>{currentCollection?.name || 'Assign to Collection'}</span>
            </button>
            
          </div>

          {/* --- RIGHT COLUMN: Identity & Analytics --- */}
          <div className="space-y-8">
            
            {/* 1. IDENTITY & PRICE (The core of the app) */}
            <section className="space-y-6">
              
              <div className="space-y-4">
                {edit.field === 'title' ? (
                  <div className="flex items-center gap-3 bg-[#0F111A] p-4 rounded-2xl border border-white/10 shadow-2xl">
                    <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
                      className="text-3xl lg:text-4xl font-black text-white bg-transparent outline-none w-full tracking-tight" />
                    <button onClick={() => edit.save()} className="p-3 bg-blue-600 rounded-xl text-white hover:bg-blue-500 transition-colors"><Save size={18} /></button>
                    <button onClick={edit.cancel} className="p-3 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"><X size={18} /></button>
                  </div>
                ) : (
                  <h1 className="text-4xl lg:text-5xl font-black text-white hover:text-slate-200 transition-colors tracking-tight leading-[1.1] group cursor-pointer flex items-start gap-4"
                    onClick={() => isComplete && edit.start('title', item.title || '')}>
                    {item.title || 'Awaiting Identification...'}
                    {isComplete && <div className="mt-2 p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"><Pencil size={18} className="text-slate-400" /></div>}
                  </h1>
                )}
                
                {/* TAGS */}
                {(item.tags && item.tags.length > 0) && (
                  <div className="flex flex-wrap gap-2 pt-2 group/tags relative">
                    {edit.field === 'tags' ? (
                      <div className="w-full flex items-center gap-2 bg-[#0F111A] p-2 rounded-xl border border-white/10">
                        <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)} placeholder="tag1, tag2..."
                          className="flex-1 bg-transparent px-2 text-sm text-white outline-none font-bold placeholder:text-slate-600" />
                        <button onClick={edit.save} className="px-3 py-1.5 bg-blue-600 rounded-lg text-white text-xs font-bold">Save</button>
                        <button onClick={edit.cancel} className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-slate-400 text-xs font-bold">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {item.tags.map((tag, i) => (
                          <span key={i} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-bold text-slate-300 tracking-wide transition-colors">
                            {tag}
                          </span>
                        ))}
                        {isComplete && (
                          <button onClick={() => edit.start('tags', (item.tags || []).join(', '))}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 opacity-0 group-hover/tags:opacity-100 transition-opacity">
                            <Pencil size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Price Callout */}
              <div className="mt-8 rounded-[2rem] bg-gradient-to-br from-[#121520] to-[#0A0C13] border border-blue-500/20 p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute -inset-2 bg-blue-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="space-y-1">
                    <h2 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Estimated Market Value</h2>
                    {price ? (
                      <span className="text-5xl md:text-6xl font-black text-white tabular-nums tracking-tighter drop-shadow-md">{price}</span>
                    ) : (
                      <span className="text-3xl font-black text-slate-600 italic tracking-tight">
                        {isProcessing ? 'Analyzing Data...' : 'No Value Available'}
                      </span>
                    )}
                  </div>
                </div>

                {item.valuation && (
                  <div className="relative z-10 mt-8 pt-6 border-t border-blue-500/10">
                    <div className="prose prose-invert prose-p:text-slate-300 prose-p:leading-relaxed prose-strong:text-white max-w-none text-sm font-medium">
                      <ReactMarkdown>{item.valuation.replace(price || '', '')}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 2. REASONING & SIGNIFICANCE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="rounded-[2rem] bg-[#0F111A] border border-white/5 p-8 shadow-xl">
                <EditableText
                  label="Historical Context"
                  fieldName="historicalContext"
                  content={item.historicalContext}
                  locked={isLocked('historicalContext')}
                  editable={isComplete}
                  edit={edit}
                  multiline
                />
              </section>

              <section className="rounded-[2rem] bg-[#0F111A] border border-white/5 p-8 shadow-xl">
                <EditableText
                  label="Collector Significance"
                  fieldName="collectorSignificance"
                  content={item.collectorSignificance}
                  locked={isLocked('collectorSignificance')}
                  editable={isComplete}
                  edit={edit}
                  multiline
                />
              </section>
            </div>

            {/* 3. VERIFICATION (Warnings / Next steps) */}
            {item.verification_questions && item.verification_questions.length > 0 && (
              <section className="rounded-3xl bg-amber-500/5 border border-amber-500/20 p-8 shadow-xl">
                <h3 className="text-xs font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                  <HelpCircle size={16} /> Verification Checklist
                </h3>
                <ul className="space-y-4">
                  {item.verification_questions.map((q, i) => (
                    <li key={i} className="flex gap-4 items-start bg-[#0A0C13]/50 p-4 rounded-2xl border border-amber-500/10 hover:border-amber-500/30 transition-colors">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-sm font-medium text-slate-300 leading-relaxed">{q}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 4. EXPANDABLE: Tech Details & OCR */}
            <section className="pt-8">
              <button onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between p-6 rounded-3xl bg-[#0F111A] border border-white/5 hover:bg-white/5 text-sm font-bold text-slate-400 hover:text-white transition-all">
                <span className="uppercase tracking-widest text-xs">Deep Dive Analytics & OCR</span>
                <ChevronDown size={18} className={cn('transition-transform duration-500', showDetails && 'rotate-180 text-blue-400')} />
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-6 space-y-6">
                      
                      {/* OCR Box */}
                      <div className="rounded-3xl bg-[#0A0C13] border border-white/5 p-8">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Document OCR</h3>
                          <div className="flex items-center gap-3">
                            {isComplete && edit.field !== 'cleanedTranscription' && (
                              <button onClick={() => edit.start('cleanedTranscription', item.cleanedTranscription || '')}
                                className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-1.5"><Pencil size={12} /> Edit</button>
                            )}
                          </div>
                        </div>
                        
                        {edit.field === 'cleanedTranscription' ? (
                          <div className="space-y-3">
                            <textarea autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
                              className="w-full bg-[#0F111A] border border-blue-500/30 rounded-2xl p-6 font-mono text-xs text-blue-200 leading-relaxed outline-none resize-y min-h-[300px]" />
                            <div className="flex gap-2 justify-end">
                              <button onClick={edit.cancel} className="px-4 py-2 hover:bg-white/5 rounded-xl text-slate-400 text-xs font-bold transition-colors">Cancel</button>
                              <button onClick={edit.save} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors">Save Updates</button>
                            </div>
                          </div>
                        ) : (
                          <div className="font-mono text-xs text-slate-500 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {item.cleanedTranscription || <span className="italic text-slate-700">No transcription data available.</span>}
                          </div>
                        )}
                      </div>

                      {/* Entities & Perf Data */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {item.identifiedNames && item.identifiedNames.length > 0 && (
                          <div className="rounded-3xl bg-[#0F111A] border border-white/5 p-8">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Linked Entities</h3>
                            <div className="space-y-4">
                              {item.identifiedNames.map((e, i) => (
                                <div key={i} className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/5">
                                  <div>
                                    <span className="text-sm font-bold text-white">{e.name}</span>
                                    {e.historicalNote && <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2">{e.historicalNote}</p>}
                                  </div>
                                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-md shrink-0">
                                    {e.type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="rounded-3xl bg-[#0F111A] border border-white/5 p-8 flex flex-col justify-center">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 text-center">Pipeline Metrics</h3>
                          <div className="grid grid-cols-2 gap-8 text-center">
                            <div>
                              <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{item.aiDurationMs ? `${(item.aiDurationMs / 1000).toFixed(1)}` : '—'}<span className="text-slate-500 text-xl font-bold ml-1">s</span></p>
                              <p className="text-xs font-bold text-slate-500 mt-2">AI Execution</p>
                            </div>
                            <div>
                              <p className="text-4xl font-black text-blue-400 tabular-nums tracking-tighter">{item.totalProcessingMs ? `${(item.totalProcessingMs / 1000).toFixed(1)}` : '—'}<span className="text-blue-500/50 text-xl font-bold ml-1">s</span></p>
                              <p className="text-xs font-bold text-slate-500 mt-2">Total Time</p>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
            
          </div>
        </div>
      </div>

      {/* ===== COLLECTION MODAL ===== */}
      <AnimatePresence>
        {showCollectionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCollectionModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-[#0B0D13] w-full max-w-lg rounded-[2rem] border border-white/10 shadow-[0_0_100px_-20px_rgba(0,0,0,1)] p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white tracking-tight">Organization</h3>
                <button onClick={() => setShowCollectionModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"><X size={20} /></button>
              </div>
              
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 mb-8 custom-scrollbar">
                {collections.map(c => (
                  <button key={c.id} onClick={() => handleAssignCollection(c.id)}
                    className={cn(
                      'w-full flex items-center justify-between p-4 rounded-2xl border text-left text-sm font-bold transition-all',
                      item.collection_id === c.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-[#0F111A] border-white/5 hover:border-white/20 hover:bg-white/5 text-slate-300'
                    )}>
                    <span className="truncate">{c.name}</span>
                    {item.collection_id === c.id && <Check size={16} className="shrink-0" />}
                  </button>
                ))}
                {item.collection_id && (
                  <button onClick={() => handleAssignCollection(null)}
                    className="w-full p-4 mt-4 rounded-xl border border-dashed border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-bold transition-colors">
                    Remove from current collection
                  </button>
                )}
              </div>
              
              <div className="p-4 bg-[#0F111A] border border-white/5 rounded-2xl flex gap-3 focus-within:border-blue-500/50 transition-colors">
                <input type="text" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)}
                  placeholder="Create new collection..."
                  className="flex-1 bg-transparent px-2 text-sm text-white font-medium outline-none placeholder:text-slate-600" />
                <button onClick={handleCreateCollection} disabled={!newCollectionName.trim()}
                  className="p-3 bg-white text-black rounded-xl hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-transform"><Plus size={18} strokeWidth={3} /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
