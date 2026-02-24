"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, AlertCircle, RefreshCw, Copy, Check, Pencil, Save, X,
  Lock, ChevronDown, Tag, Plus, HelpCircle, ExternalLink
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
            className="w-full bg-[var(--surface-800)] border border-[var(--accent-warm)]/50 rounded-[8px] px-5 py-4 text-[14px] text-[var(--text-100)] leading-relaxed outline-none resize-none min-h-[160px] shadow-inner transition-colors focus:border-[var(--accent-warm)] focus:ring-1 focus:ring-[var(--accent-warm)]/50" />
        ) : (
          <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') edit.save(); if (e.key === 'Escape') edit.cancel(); }}
            className="w-full bg-[var(--surface-800)] border border-[var(--accent-warm)]/50 rounded-[8px] px-5 py-3 text-[14px] text-[var(--text-100)] outline-none shadow-inner transition-colors focus:border-[var(--accent-warm)] focus:ring-1 focus:ring-[var(--accent-warm)]/50" />
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={edit.cancel} className="px-4 py-2 hover:bg-[var(--surface-780)] text-[var(--text-300)] text-[12px] font-semibold rounded-[6px] transition-colors">Cancel</button>
          <button onClick={edit.save} className="px-5 py-2 bg-[var(--accent-warm)] hover:bg-[#A88B52] text-[#0A0A0B] text-[12px] font-semibold rounded-[6px] flex items-center gap-1.5 transition-colors shadow-lg"><Save size={14} />Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/field relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-black text-[var(--accent-cool)] uppercase tracking-[0.2em] flex items-center gap-2">
          {label}
          {locked && <Lock size={12} className="text-[var(--status-review)]" />}
        </h3>
        {editable && content && !locked && (
          <button onClick={() => edit.start(fieldName, content)}
            className="text-[12px] font-semibold text-[var(--text-300)] hover:text-[var(--text-100)] flex items-center gap-1.5 opacity-0 group-hover/field:opacity-100 transition-all bg-[var(--surface-800)] px-2 py-1 rounded-[6px] border border-[var(--glass-01)] hover:border-[var(--accent-warm)]/30">
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
      {content ? (
        <div className="text-[14px] text-[var(--text-200)] leading-[1.6] prose prose-invert prose-p:my-2 prose-strong:text-[var(--text-100)] max-w-none font-normal">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-[14px] text-[var(--text-300)] font-normal italic">Pending analysis...</p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config = status === 'complete'
    ? { bg: 'bg-[var(--accent-warm)]/10', text: 'text-[var(--accent-warm)]', border: 'border-[var(--accent-warm)]/20', label: 'Complete' }
    : status === 'error'
    ? { bg: 'bg-[var(--status-review)]/10', text: 'text-[var(--status-review)]', border: 'border-[var(--status-review)]/20', label: 'Error' }
    : { bg: 'bg-[var(--status-processing)]/10', text: 'text-[var(--status-processing)]', border: 'border-[var(--status-processing)]/20 animate-pulse', label: status.replace(/_/g, ' ') };
  return (
    <span className={cn('px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-widest border', config.bg, config.text, config.border)}>
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-900)]">
        <RefreshCw className="w-8 h-8 text-[var(--accent-cool)] animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-900)] p-6">
        <div className="max-w-sm text-center space-y-6">
          <div className="w-20 h-20 bg-[var(--status-review)]/10 border border-[var(--status-review)]/20 rounded-full flex items-center justify-center mx-auto shadow-2xl">
            <AlertCircle className="w-10 h-10 text-[var(--status-review)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-100)] tracking-tight">Item not found</h1>
          <button onClick={() => router.push('/')} className="px-8 py-3.5 bg-[var(--surface-800)] text-[var(--text-100)] border border-[var(--glass-01)] hover:border-[var(--glass-02)] text-sm font-semibold rounded-[8px] hover-lift transition-all">
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
      ? "processing-grayscale blur-sm"
      : item.status === 'processing_ai'
        ? "processing-mid"
        : "processing-complete"
  );

  return (
    <main className="min-h-screen bg-[var(--bg-900)] text-[var(--text-100)] pb-[120px] font-sans">
      
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-[var(--bg-900)]/90 backdrop-blur-xl border-b border-[var(--glass-01)] px-[32px] py-[16px] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')}
            className="p-[8px] rounded-[6px] bg-transparent border border-[var(--glass-01)] hover:bg-[var(--glass-02)] text-[var(--text-200)] hover:text-[var(--text-100)] transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3">
            <StatusPill status={item.status} />
            {item.guessedId && (
              <span className="text-[12px] font-mono text-[var(--text-300)] bg-[var(--surface-800)] px-2 py-1 rounded-[4px]">
                ID: {item.guessedId}
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
              className="px-4 py-2 hover:bg-[var(--glass-01)] rounded-[6px] text-[12px] font-semibold text-[var(--text-300)] hover:text-[var(--text-100)] transition-colors flex items-center gap-2">
              <Copy size={14} /> JSON Data
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
              className="px-5 py-2.5 bg-[var(--surface-800)] hover:bg-[var(--surface-780)] text-[var(--accent-warm)] border border-[var(--accent-warm)] text-[12px] font-semibold rounded-[6px] transition-all hover-lift flex items-center gap-2">
              <ExternalLink size={14} /> Export Listing
            </button>
          </div>
        )}
      </header>

      <div className="max-w-[1280px] mx-auto px-[16px] md:px-[32px] pt-[40px]">
        
        {/* ===== ERROR BANNER ===== */}
        {isError && item.errorMessage && (
          <div className="mb-8 p-6 rounded-[8px] bg-[var(--status-review)]/10 border border-[var(--status-review)]/20 flex items-center justify-between gap-6 backdrop-blur-md">
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-3 bg-[var(--status-review)]/20 rounded-full">
                <AlertCircle size={24} className="text-[var(--status-review)]" />
              </div>
              <div>
                <h3 className="text-[var(--status-review)] font-bold tracking-tight text-[16px] mb-1">Processing Failed</h3>
                <p className="text-[12px] text-[var(--status-review)]/80 font-mono break-all">{item.errorMessage}</p>
              </div>
            </div>
            <button onClick={handleRetry} disabled={retrying}
              className="shrink-0 flex items-center gap-2 px-6 py-3 bg-[var(--status-review)] text-[#0A0A0B] text-[14px] font-bold rounded-[6px] hover:opacity-90 disabled:opacity-50 transition-all hover-lift">
              <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Retrying' : 'Retry Processing'}
            </button>
          </div>
        )}

        {/* ===== MAIN SPLIT LAYOUT (56% / 44%) ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-[56%_44%] gap-[48px] items-start">
          
          {/* --- LEFT COLUMN: Image & Primary Identity --- */}
          <div className="lg:sticky lg:top-[120px] space-y-[32px]">
            
            {/* Image Container */}
            <div className="relative group rounded-[8px] overflow-hidden bg-[var(--surface-800)] border border-[var(--glass-01)] shadow-2xl h-[400px] md:h-[600px] lg:h-[700px] flex items-center justify-center p-[24px]">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-[var(--accent-cool)] animate-spin" />
                  </div>
                )}
                
                <div className="w-full h-full relative z-0">
                  <BespokeMagnifier
                    src={`/api/items/${item.id}/image`}
                    alt={item.title || 'Item image'}
                    className={visualStateClasses}
                    onLoad={() => setImageLoaded(true)}
                  />
                </div>
                
                {/* Floating Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--surface-800)]/50 backdrop-blur-sm transition-opacity">
                      {item.status === 'processing_ai' && <div className="absolute inset-0 scan-sweep-bar opacity-30" />}
                      <div className="flex bg-[var(--glass-02)] backdrop-blur-md px-[16px] py-[8px] rounded-[6px] items-center gap-3 border border-[var(--glass-01)]">
                        <RefreshCw size={14} className="text-[var(--accent-warm)] animate-spin" />
                        <span className="text-[12px] font-medium text-[var(--text-100)] tracking-widest uppercase">
                            {item.status.replace('_', ' ')}
                        </span>
                      </div>
                  </div>
                )}
            </div>

            {/* Left Column Identity Block (Tags, Title) */}
            <div className="space-y-[16px]">
                {/* TAGS */}
                <div className="flex flex-wrap gap-2 group/tags min-h-[28px]">
                  {edit.field === 'tags' ? (
                    <div className="w-full flex items-center gap-2 bg-[var(--surface-800)] p-2 rounded-[6px] border border-[var(--glass-01)]">
                      <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)} placeholder="tag1, tag2..."
                        className="flex-1 bg-transparent px-2 text-[12px] text-[var(--text-100)] outline-none font-medium placeholder:text-[var(--text-300)]" />
                      <button onClick={edit.save} className="px-3 py-1.5 bg-[var(--accent-warm)] text-[#0A0A0B] rounded-[4px] text-[10px] font-bold">Save</button>
                      <button onClick={edit.cancel} className="px-3 py-1.5 hover:bg-[var(--glass-01)] rounded-[4px] text-[var(--text-300)] text-[10px] font-bold">Cancel</button>
                    </div>
                  ) : (
                    <>
                      {item.tags && item.tags.length > 0 ? item.tags.map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-[var(--surface-800)] hover:bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[4px] text-[10px] font-medium text-[var(--text-200)] uppercase tracking-wider transition-colors cursor-default">
                          {tag}
                        </span>
                      )) : (
                        <span className="text-[12px] text-[var(--text-300)] italic pl-1">No tags</span>
                      )}
                      
                      {isComplete && (
                        <button onClick={() => edit.start('tags', (item.tags || []).join(', '))}
                          className="px-2 hover:bg-[var(--glass-01)] rounded-[4px] text-[var(--text-300)] opacity-0 group-hover/tags:opacity-100 transition-opacity flex items-center border border-transparent hover:border-[var(--glass-01)]">
                          <Pencil size={12} className="mr-1" /> Add
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* TITLE */}
                {edit.field === 'title' ? (
                  <div className="flex items-center gap-3 bg-[var(--surface-800)] p-4 rounded-[6px] border border-[var(--accent-warm)]/30">
                    <input autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
                      className="text-[24px] md:text-[32px] font-serif text-[var(--text-100)] bg-transparent outline-none w-full leading-tight" />
                    <button onClick={() => edit.save()} className="p-2 bg-[var(--accent-warm)] rounded-[4px] text-[#0A0A0B] hover:opacity-90"><Save size={16} /></button>
                    <button onClick={edit.cancel} className="p-2 hover:bg-[var(--glass-01)] rounded-[4px] text-[var(--text-300)]"><X size={16} /></button>
                  </div>
                ) : (
                  <h1 className="text-[32px] md:text-[40px] font-serif text-[var(--text-100)] leading-tight tracking-tight group cursor-pointer flex items-start gap-4"
                    onClick={() => isComplete && edit.start('title', item.title || '')}>
                    {item.title || 'Awaiting Identification...'}
                    {isComplete && <div className="mt-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all"><Pencil size={16} className="text-[var(--text-300)] hover:text-[var(--text-100)]" /></div>}
                  </h1>
                )}
            </div>

          </div>

          {/* --- RIGHT COLUMN: Analytics, Pricing & Metadata --- */}
          <div className="space-y-[40px] pt-2">
            
            {/* Prominent Price Row */}
            <div className="border border-[var(--glass-01)] rounded-[8px] bg-[var(--surface-800)] p-[32px] relative overflow-hidden">
                <p className="text-[12px] font-bold text-[var(--accent-cool)] uppercase tracking-widest mb-[16px]">Current Estimate</p>
                {price ? (
                    <div className="text-[48px] md:text-[64px] font-serif text-[var(--accent-warm)] leading-none tracking-tight">
                        {price}
                    </div>
                ) : (
                    <div className="text-[24px] font-serif text-[var(--text-300)] italic">
                        {isProcessing ? 'Analyzing value...' : 'Indeterminate Value'}
                    </div>
                )}
            </div>

            {/* AI Reasoning Module */}
            <div className="relative pl-[24px] border-l-[3px] border-[var(--accent-cool)] bg-[var(--surface-800)]/30 p-[24px] pr-0 rounded-r-[8px]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-cool)] mb-[16px]">Market Rationale</h3>
                {item.valuation ? (
                   <div className="text-[14px] text-[var(--text-200)] leading-[1.6] prose prose-invert prose-p:my-2 prose-strong:text-[var(--text-100)] max-w-none font-normal">
                      <ReactMarkdown>{item.valuation.replace(price || '', '')}</ReactMarkdown>
                   </div>
                ) : (
                   <div className="text-[14px] text-[var(--text-300)] italic font-normal">Pending deep dive rationale.</div>
                )}
            </div>

            {/* Other Metadata Blocks */}
            <div className="space-y-[24px]">
                <section className="bg-[var(--surface-800)] border border-[var(--glass-01)] rounded-[8px] p-[24px]">
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

                <section className="bg-[var(--surface-800)] border border-[var(--glass-01)] rounded-[8px] p-[24px]">
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

            {/* Verification Checklist */}
            {item.verification_questions && item.verification_questions.length > 0 && (
              <section className="bg-[var(--surface-800)] border border-[var(--accent-warm)]/20 p-[24px] rounded-[8px]">
                <h3 className="text-[10px] font-bold text-[var(--accent-warm)] uppercase tracking-[0.2em] flex items-center gap-2 mb-[24px]">
                  <HelpCircle size={14} /> Verification Protocol
                </h3>
                <ul className="space-y-[16px]">
                  {item.verification_questions.map((q, i) => (
                    <li key={i} className="flex gap-[16px] items-start">
                      <span className="flex items-center justify-center w-5 h-5 rounded-[4px] bg-[var(--accent-warm)]/10 text-[var(--accent-warm)] text-[10px] font-bold shrink-0 mt-0.5 border border-[var(--accent-warm)]/30">{i + 1}</span>
                      <span className="text-[14px] font-normal text-[var(--text-200)] leading-[1.5]">{q}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Collection Assign */}
            <div className="pt-4 hidden md:block">
                <button onClick={() => setShowCollectionModal(true)}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 px-6 py-4 rounded-[8px] border transition-luxury text-[14px] font-medium h-[56px]',
                    currentCollection
                      ? 'bg-[var(--surface-780)] border-[var(--accent-cool)] text-[var(--text-100)] hover:bg-[var(--surface-800)]'
                      : 'bg-[var(--surface-800)] border-dashed border-[var(--glass-02)] text-[var(--text-300)] hover:text-[var(--text-100)] hover:border-[var(--glass-01)]'
                  )}>
                  {currentCollection ? <Tag size={16} className="text-[var(--accent-cool)]" /> : <Plus size={16} />}
                  <span>{currentCollection?.name || 'Assign to Collection...'}</span>
                </button>
            </div>

            {/* Extracted Entities / Deep Dive Accordion */}
            <section className="pt-4">
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between py-[16px] border-b border-[var(--glass-01)] text-[14px] font-bold text-[var(--text-200)] hover:text-[var(--text-100)] transition-colors group"
              >
                <span>Deep Dive Analytics & OCR Raw Data</span>
                <ChevronDown size={16} className={cn('transition-transform duration-300 text-[var(--text-300)] group-hover:text-[var(--text-100)]', showDetails && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-[32px] space-y-[40px] pb-4">
                      
                      {/* Perf Data */}
                      <div className="grid grid-cols-2 gap-[16px]">
                          <div className="bg-[var(--surface-800)] border border-[var(--glass-01)] p-[24px] rounded-[8px] text-center">
                              <p className="text-[32px] font-serif text-[var(--text-100)]">{item.aiDurationMs ? `${(item.aiDurationMs / 1000).toFixed(1)}` : '—'}<span className="text-[var(--text-300)] text-[14px] ml-1">s</span></p>
                              <p className="text-[10px] font-bold text-[var(--text-300)] uppercase tracking-wider mt-2">AI Execution</p>
                          </div>
                          <div className="bg-[var(--surface-800)] border border-[var(--glass-01)] p-[24px] rounded-[8px] text-center">
                              <p className="text-[32px] font-serif text-[var(--text-100)]">{item.totalProcessingMs ? `${(item.totalProcessingMs / 1000).toFixed(1)}` : '—'}<span className="text-[var(--text-300)] text-[14px] ml-1">s</span></p>
                              <p className="text-[10px] font-bold text-[var(--text-300)] uppercase tracking-wider mt-2">Total Time</p>
                          </div>
                      </div>

                      {/* Entities */}
                      {item.identifiedNames && item.identifiedNames.length > 0 && (
                          <div className="bg-[var(--surface-800)] border border-[var(--glass-01)] p-[32px] rounded-[8px]">
                            <h3 className="text-[10px] font-bold text-[var(--text-300)] uppercase tracking-[0.2em] mb-[24px]">Linked Entities</h3>
                            <div className="space-y-[16px]">
                              {item.identifiedNames.map((e, i) => (
                                <div key={i} className="flex items-start justify-between gap-4 pb-[16px] border-b border-[var(--glass-01)] last:border-0 last:pb-0">
                                  <div>
                                    <span className="text-[14px] font-bold text-[var(--text-100)]">{e.name}</span>
                                    {e.historicalNote && <p className="text-[12px] text-[var(--text-300)] mt-1">{e.historicalNote}</p>}
                                  </div>
                                  <span className="text-[10px] uppercase tracking-wider bg-[var(--surface-780)] px-2 py-1 rounded-[4px] text-[var(--accent-cool)] shrink-0 border border-[var(--glass-01)]">
                                    {e.type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                      )}

                      {/* OCR Raw */}
                      <div className="bg-[var(--surface-800)] border border-[var(--glass-01)] p-[32px] rounded-[8px]">
                        <div className="flex items-center justify-between mb-[24px]">
                          <h3 className="text-[10px] font-bold text-[var(--text-300)] uppercase tracking-[0.2em]">Raw OCR Transcript</h3>
                        </div>
                        
                        {edit.field === 'cleanedTranscription' ? (
                          <div className="space-y-4">
                            <textarea autoFocus value={edit.value} onChange={e => edit.setValue(e.target.value)}
                              className="w-full bg-[var(--surface-780)] border border-[var(--glass-02)] rounded-[6px] p-4 font-mono text-[12px] text-[var(--text-200)] leading-[1.6] outline-none resize-y min-h-[300px]" />
                            <div className="flex gap-3 justify-end">
                              <button onClick={edit.cancel} className="px-4 py-2 hover:bg-[var(--glass-01)] rounded-[4px] text-[var(--text-300)] text-[12px] font-semibold transition-colors">Cancel</button>
                              <button onClick={edit.save} className="px-5 py-2 bg-[var(--surface-780)] border border-[var(--glass-02)] hover:border-[var(--glass-01)] text-[var(--text-100)] text-[12px] font-semibold rounded-[4px] transition-colors">Save Updates</button>
                            </div>
                          </div>
                        ) : (
                          <div className="font-mono text-[12px] text-[var(--text-300)] leading-[1.6] whitespace-pre-wrap max-h-[400px] overflow-y-auto pr-4 custom-scrollbar group relative">
                            {item.cleanedTranscription || <span className="italic">No transcription data available.</span>}
                            {isComplete && (
                               <button onClick={() => edit.start('cleanedTranscription', item.cleanedTranscription || '')}
                                 className="absolute top-0 right-4 p-2 bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[4px] text-[var(--text-300)] hover:text-[var(--text-100)] opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Pencil size={14} />
                               </button>
                            )}
                          </div>
                        )}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCollectionModal(false)} className="absolute inset-0 bg-[#0A0A0B]/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.98, opacity: 0, y: 10 }}
              className="relative bg-[var(--surface-800)] w-full max-w-md rounded-[12px] border border-[var(--glass-02)] shadow-2xl p-[32px]">
              <div className="flex items-center justify-between mb-[32px]">
                <h3 className="text-[18px] font-serif font-bold text-[var(--text-100)] tracking-tight">Select Collection</h3>
                <button onClick={() => setShowCollectionModal(false)} className="p-2 hover:bg-[var(--glass-01)] rounded-[6px] transition-colors text-[var(--text-300)] hover:text-[var(--text-100)]"><X size={16} /></button>
              </div>
              
              <div className="space-y-[8px] max-h-[40vh] overflow-y-auto pr-2 mb-[32px] custom-scrollbar">
                {collections.map(c => (
                  <button key={c.id} onClick={() => handleAssignCollection(c.id)}
                    className={cn(
                      'w-full flex items-center justify-between p-4 rounded-[6px] border text-left text-[14px] font-medium transition-luxury',
                      item.collection_id === c.id ? 'bg-[var(--surface-780)] border-[var(--accent-cool)] text-[var(--text-100)]' : 'bg-transparent border-transparent hover:bg-[var(--glass-01)] border-[var(--glass-01)] text-[var(--text-200)]'
                    )}>
                    <span className="truncate">{c.name}</span>
                    {item.collection_id === c.id && <Check size={16} className="text-[var(--accent-cool)]" />}
                  </button>
                ))}
                {item.collection_id && (
                  <button onClick={() => handleAssignCollection(null)}
                    className="w-full p-4 mt-[16px] rounded-[6px] border-none text-[var(--status-review)] hover:bg-[var(--status-review)]/10 text-[14px] font-medium transition-colors text-left">
                    Remove from current
                  </button>
                )}
              </div>
              
              <div className="p-[8px] bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[6px] flex gap-3 focus-within:border-[var(--accent-cool)] transition-colors">
                <input type="text" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)}
                  placeholder="New collection name..."
                  className="flex-1 bg-transparent pl-3 text-[14px] text-[var(--text-100)] font-medium outline-none placeholder:text-[var(--text-300)]" />
                <button onClick={handleCreateCollection} disabled={!newCollectionName.trim()}
                  className="p-[8px] px-[16px] bg-[var(--surface-800)] border border-[var(--glass-02)] text-[var(--text-100)] rounded-[4px] disabled:opacity-50 transition-colors text-[12px] font-semibold"><Plus size={14} /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
