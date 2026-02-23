"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, AlertCircle, RefreshCw, Copy, Check, Pencil, Save, X,
  Lock, ChevronDown, Tag, Plus, FolderPlus, HelpCircle, DollarSign,
  ExternalLink, Clock, Sparkles
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
      <div className="space-y-2">
        {multiline ? (
          <textarea autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
            className="w-full bg-slate-950 border border-blue-500/40 rounded-xl px-4 py-3 text-sm text-slate-300 leading-relaxed outline-none resize-none min-h-[160px]" />
        ) : (
          <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') edit.save(); if (e.key === 'Escape') edit.cancel(); }}
            className="w-full bg-slate-950 border border-blue-500/40 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none" />
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={edit.cancel} className="px-3 py-1.5 bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg">Cancel</button>
          <button onClick={edit.save} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1"><Save size={12} />Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/field">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          {label}
          {locked && <Lock size={10} className="text-amber-500/60" />}
        </h3>
        {editable && content && !locked && (
          <button onClick={() => edit.start(fieldName, content)}
            className="text-xs text-slate-600 hover:text-blue-400 flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
            <Pencil size={10} /> Edit
          </button>
        )}
      </div>
      {content ? (
        <div className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-blue-300">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-slate-700 italic">Pending analysis...</p>
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
    <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border', config.bg, config.text, config.border)}>
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
    const interval = setInterval(() => {
      if (item && !['complete', 'error'].includes(item.status)) fetchItem();
    }, 3000);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="h-10 w-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-sm text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Item not found</h1>
          <button onClick={() => router.push('/')} className="px-6 py-3 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700">
            Back to inventory
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">

        {/* ===== HEADER ===== */}
        <div className="flex items-start gap-4 mb-8">
          <button onClick={() => router.push('/')}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors mt-1 shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <StatusPill status={item.status} />
              {item.guessedId && (
                <span className="text-[10px] font-mono text-slate-600 bg-slate-900 px-2 py-0.5 rounded">
                  {item.guessedId}
                </span>
              )}
            </div>
            {edit.field === 'title' ? (
              <div className="flex items-center gap-2">
                <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') edit.save(); if (e.key === 'Escape') edit.cancel(); }}
                  className="text-2xl font-bold text-white bg-transparent border-b-2 border-blue-500 outline-none w-full pb-1" />
                <button onClick={() => edit.save()} className="p-1.5 bg-blue-600 rounded-lg text-white"><Save size={14} /></button>
                <button onClick={edit.cancel} className="p-1.5 bg-slate-800 rounded-lg text-slate-400"><X size={14} /></button>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-white truncate group cursor-pointer flex items-center gap-2"
                onClick={() => isComplete && edit.start('title', item.title || '')}>
                {item.title || 'Unidentified Item'}
                {isComplete && <Pencil size={14} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </h1>
            )}
          </div>
        </div>

        {/* ===== ERROR BANNER ===== */}
        {isError && item.errorMessage && (
          <div className="mb-8 p-5 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300 font-mono break-all">{item.errorMessage}</p>
            </div>
            <button onClick={handleRetry} disabled={retrying}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-red-500/10 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50">
              <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Retrying' : 'Retry'}
            </button>
          </div>
        )}

        {/* ===== TWO COLUMN LAYOUT ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">

          {/* --- LEFT: Image --- */}
          <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-4">
            <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl">
              <div className="aspect-[4/5] relative flex items-center justify-center bg-slate-950">
                {!imageLoaded && (
                  <RefreshCw className="w-6 h-6 text-slate-800 animate-spin absolute z-10" />
                )}
                <BespokeMagnifier
                  src={`/api/items/${item.id}/image`}
                  alt={item.title || 'Item'}
                  className={cn('w-full h-full object-contain transition-opacity duration-500', imageLoaded ? 'opacity-100' : 'opacity-0')}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </div>

            {/* Quick stats under image */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="py-3 px-4 rounded-xl bg-slate-900/60 border border-slate-800/50">
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Confidence</p>
                <p className="text-lg font-bold text-white tabular-nums">{((item.confidence || 0) * 100).toFixed(0)}%</p>
              </div>
              <div className="py-3 px-4 rounded-xl bg-slate-900/60 border border-slate-800/50">
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Processed</p>
                <p className="text-sm font-semibold text-slate-300">
                  {item.processedAt ? formatDistanceToNow(new Date(item.processedAt), { addSuffix: true }) : '—'}
                </p>
              </div>
            </div>

            {/* Collection tag */}
            <button onClick={() => setShowCollectionModal(true)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-colors text-sm',
                currentCollection
                  ? 'bg-blue-500/5 border-blue-500/20 text-blue-300 hover:bg-blue-500/10'
                  : 'bg-slate-900/40 border-slate-800 text-slate-600 hover:border-slate-700'
              )}>
              {currentCollection ? <Tag size={14} /> : <Plus size={14} />}
              <span className="font-semibold truncate">{currentCollection?.name || 'Add to collection'}</span>
            </button>
          </div>

          {/* --- RIGHT: Information --- */}
          <div className="lg:col-span-3 space-y-6">

            {/* 1. VALUATION — the money shot */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="p-6 pb-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valuation</h2>
                  {price && (
                    <span className="text-3xl font-bold text-white tabular-nums tracking-tight">{price}</span>
                  )}
                </div>
                {!price && !isProcessing && (
                  <p className="text-sm text-slate-600 italic">No valuation available</p>
                )}
                {isProcessing && !price && (
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <RefreshCw size={14} className="animate-spin" /> Analyzing...
                  </div>
                )}
              </div>
              {item.valuation && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-800/50">
                  <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{item.valuation}</p>
                </div>
              )}
            </section>

            {/* 2. WHY — Historical context + collector significance */}
            {(item.historicalContext || item.collectorSignificance || isComplete) && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
                <EditableText
                  label="Historical Context"
                  fieldName="historicalContext"
                  content={item.historicalContext}
                  locked={isLocked('historicalContext')}
                  editable={isComplete}
                  edit={edit}
                  multiline
                />
                {(item.collectorSignificance || isComplete) && (
                  <>
                    <div className="h-px bg-slate-800" />
                    <EditableText
                      label="Collector Significance"
                      fieldName="collectorSignificance"
                      content={item.collectorSignificance}
                      locked={isLocked('collectorSignificance')}
                      editable={isComplete}
                      edit={edit}
                      multiline
                    />
                  </>
                )}
              </section>
            )}

            {/* 3. VERIFY — What to check next */}
            {item.verification_questions && item.verification_questions.length > 0 && (
              <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-3">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                  <HelpCircle size={14} /> To verify
                </h3>
                <ul className="space-y-2">
                  {item.verification_questions.map((q, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <span className="text-amber-500/60 mt-0.5 shrink-0">{i + 1}.</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 4. TAGS */}
            {(item.tags && item.tags.length > 0) && (
              <section className="group/field">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tags</h3>
                  {isComplete && edit.field !== 'tags' && (
                    <button onClick={() => edit.start('tags', (item.tags || []).join(', '))}
                      className="text-xs text-slate-600 hover:text-blue-400 flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
                      <Pencil size={10} /> Edit
                    </button>
                  )}
                </div>
                {edit.field === 'tags' ? (
                  <div className="space-y-2">
                    <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') edit.save(); if (e.key === 'Escape') edit.cancel(); }}
                      placeholder="tag1, tag2, tag3..."
                      className="w-full bg-slate-950 border border-blue-500/40 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={edit.cancel} className="px-3 py-1.5 bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg">Cancel</button>
                      <button onClick={edit.save} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 5. MORE DETAILS — collapsible */}
            <button onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:text-slate-400 transition-colors">
              <span>Transcription & Details</span>
              <ChevronDown size={14} className={cn('transition-transform', showDetails && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-6"
                >
                  {/* Transcription */}
                  <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Transcription</h3>
                      <div className="flex items-center gap-2">
                        {isComplete && edit.field !== 'cleanedTranscription' && (
                          <button onClick={() => edit.start('cleanedTranscription', item.cleanedTranscription || '')}
                            className="text-xs text-slate-600 hover:text-blue-400 flex items-center gap-1"><Pencil size={10} /> Edit</button>
                        )}
                        <button onClick={() => { navigator.clipboard.writeText(item.cleanedTranscription || ''); toast.success('Copied'); }}
                          className="text-xs text-slate-600 hover:text-slate-400 flex items-center gap-1"><Copy size={10} /> Copy</button>
                      </div>
                    </div>
                    {edit.field === 'cleanedTranscription' ? (
                      <div className="space-y-2">
                        <textarea autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
                          className="w-full bg-slate-950 border border-blue-500/40 rounded-xl px-4 py-3 font-mono text-sm text-slate-300 leading-relaxed outline-none resize-none min-h-[200px]" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={edit.cancel} className="px-3 py-1.5 bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg">Cancel</button>
                          <button onClick={edit.save} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-sm text-slate-400 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                        {item.cleanedTranscription || <span className="text-slate-700 italic">No transcription</span>}
                      </div>
                    )}
                  </section>

                  {/* Entities */}
                  {item.identifiedNames && item.identifiedNames.length > 0 && (
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Identified People & Places</h3>
                      <div className="space-y-3">
                        {item.identifiedNames.map((e, i) => (
                          <div key={i} className="flex items-start justify-between gap-4">
                            <div>
                              <span className="text-sm font-semibold text-slate-200">{e.name}</span>
                              {e.historicalNote && (
                                <p className="text-xs text-slate-500 mt-0.5">{e.historicalNote}</p>
                              )}
                            </div>
                            <span className="text-[10px] font-medium text-slate-600 uppercase bg-slate-900 px-2 py-0.5 rounded shrink-0">
                              {e.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Processing Stats */}
                  <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Processing</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold text-slate-300 tabular-nums">{item.aiDurationMs ? `${(item.aiDurationMs / 1000).toFixed(1)}s` : '—'}</p>
                        <p className="text-[10px] text-slate-600 font-medium">AI Time</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-300 tabular-nums">{item.totalProcessingMs ? `${(item.totalProcessingMs / 1000).toFixed(1)}s` : '—'}</p>
                        <p className="text-[10px] text-slate-600 font-medium">Total Time</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-300 tabular-nums">{item.id.split('-')[0]}</p>
                        <p className="text-[10px] text-slate-600 font-medium">Item ID</p>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM ACTION BAR ===== */}
      <AnimatePresence>
        {isComplete && (
          <motion.div initial={{ y: 80 }} animate={{ y: 0 }}
            className="fixed bottom-6 inset-x-0 z-50 px-4 flex justify-center">
            <div className="bg-slate-900/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-3">
              <button onClick={() => {
                navigator.clipboard.writeText(JSON.stringify({
                  id: item.id, title: item.title, valuation: item.valuation,
                  tags: item.tags, historicalContext: item.historicalContext,
                }, null, 2));
                toast.success('Data copied');
              }}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors">
                <Copy size={13} /> Copy Data
              </button>
              <button onClick={() => {
                const listing = [
                  item.title || 'Untitled',
                  '',
                  item.historicalContext || '',
                  '',
                  item.collectorSignificance ? `${item.collectorSignificance}` : '',
                  '',
                  item.valuation ? `PRICING: ${item.valuation}` : '',
                  '',
                  item.tags?.length ? `Tags: ${item.tags.join(', ')}` : '',
                ].filter(Boolean).join('\n');
                navigator.clipboard.writeText(listing);
                toast.success('Listing draft copied');
              }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/20">
                <ExternalLink size={13} /> Copy Listing
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== COLLECTION MODAL ===== */}
      <AnimatePresence>
        {showCollectionModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCollectionModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Collections</h3>
                <button onClick={() => setShowCollectionModal(false)} className="p-1.5 hover:bg-slate-800 rounded-lg"><X size={18} /></button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {collections.map(c => (
                  <button key={c.id} onClick={() => handleAssignCollection(c.id)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl border text-left text-sm font-semibold transition-all',
                      item.collection_id === c.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    )}>
                    {c.name}
                    {item.collection_id === c.id && <Check size={14} />}
                  </button>
                ))}
                {item.collection_id && (
                  <button onClick={() => handleAssignCollection(null)}
                    className="w-full p-3 rounded-xl border border-dashed border-red-500/20 text-red-400 hover:bg-red-500/5 text-sm font-semibold">
                    Remove from collection
                  </button>
                )}
              </div>
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <input type="text" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)}
                  placeholder="New collection name..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                <button onClick={handleCreateCollection}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500"><FolderPlus size={16} /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
