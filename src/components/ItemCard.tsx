"use client";

import Link from 'next/link';
import { RefreshCw, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ValuationBlock } from './ValuationBlock';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { ValueConfidence } from '@/types/research';

interface Item {
  id: string;
  title?: string;
  status: string;
  thumbnailPath?: string;
  createdAt: string;
  is_high_value?: boolean;
  estimated_value_low?: number | null;
  estimated_value_high?: number | null;
  estimated_value_point?: number | null;
  value_confidence?: ValueConfidence | null;
  ebay_keywords?: string | null;
  confidence?: number | null;
}

export function ItemCard({ item }: { item: Item }) {
  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';
  // Has a title but not complete indicates mid-processing (e.g. AI analysis running)
  const isMidProcess = !isComplete && !isError && item.title && item.title !== 'Unidentified Document' && item.title !== '...';
  
  // Status left stripe color
  const statusStripe = isComplete ? 'bg-[var(--accent-warm)]' : isError ? 'bg-[var(--status-review)]' : 'bg-[var(--status-processing)]';

  // Image Classes
  const imageClasses = cn(
    "object-cover w-full h-full transition-luxury",
    isComplete ? "processing-complete" : isMidProcess ? "processing-mid" : "processing-grayscale"
  );

  const cardClass = cn(
    "relative bg-[var(--surface-800)] rounded-[6px] overflow-hidden hover-lift flex flex-col min-h-[420px] satin-shadow border transition-colors",
    item.is_high_value
      ? "border-[var(--accent-warm)] shadow-[0_0_16px_rgba(191,164,106,0.25)]"
      : "border-transparent hover:border-[var(--glass-01)]"
  );

  return (
    <Link href={`/items/${item.id}`} className="block group w-full max-w-[320px] mx-auto">
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.88 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        className={cardClass}
      >
        {/* Status Line */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-[4px] z-20 pointer-events-none transition-colors", statusStripe)} />

        {/* Top Thumbnail Area */}
        <div className="relative w-full h-[260px] bg-[var(--surface-780)] overflow-hidden shrink-0">
          {item.thumbnailPath ? (
            <img
              src={`/api/items/${item.id}/thumbnail`}
              alt={item.title || "Document"}
              className={imageClasses}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <LayoutDashboard className="text-[var(--surface-800)] w-8 h-8" />
            </div>
          )}

          {/* Overlays during processing */}
          {!isComplete && !isError && (
            <div className="absolute inset-0 bg-[var(--surface-800)]/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
              <RefreshCw size={20} className="text-[var(--accent-warm)] animate-spin" />
              <span className="text-[10px] font-semibold text-[var(--accent-warm)] uppercase tracking-widest">
                {item.status === 'processing_ai' ? 'Identifying…' :
                 item.status === 'processing_ocr' ? 'Reading…' :
                 item.status === 'processing_resize' ? 'Processing…' :
                 'Queued'}
              </span>
            </div>
          )}

          {/* Quick Actions (Hover) */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 duration-200">
             <div className="bg-[var(--glass-02)] backdrop-blur-sm p-2 rounded-full border border-[var(--glass-01)] shadow-lg cursor-pointer hover:bg-[var(--surface-780)] transition-colors">
               <span className="sr-only">Quick View</span>
               <div className="w-4 h-4 rounded-full border-2 border-[var(--text-100)]" />
             </div>
          </div>
        </div>
        
        {/* Footer Bar */}
        <div className="p-[16px] pl-[20px] flex-grow flex flex-col justify-between">
           <div>
              <h2 className="text-[14px] font-semibold text-[var(--text-100)] leading-tight line-clamp-2">
                  {item.title || "Unidentified Item..."}
              </h2>
              <div className="mt-1">
                <ConfidenceBadge confidence={item.confidence ?? null} />
              </div>
           </div>
           
           <ValuationBlock
             estimated_value_low={item.estimated_value_low ?? null}
             estimated_value_high={item.estimated_value_high ?? null}
             estimated_value_point={item.estimated_value_point ?? null}
             value_confidence={item.value_confidence ?? null}
             is_high_value={item.is_high_value || false}
             ebay_keywords={item.ebay_keywords ?? null}
             compact
           />
        </div>
      </motion.div>
    </Link>
  );
}
