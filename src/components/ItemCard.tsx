"use client";

import Link from 'next/link';
import { RefreshCw, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Item {
  id: string;
  title?: string;
  status: string;
  thumbnailPath?: string;
  createdAt: string;
  valuation?: string;
}

export function ItemCard({ item }: { item: Item }) {
  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';
  // Has a title but not complete indicates mid-processing (e.g. AI analysis running)
  const isMidProcess = !isComplete && !isError && item.title && item.title !== 'Unidentified Document' && item.title !== '...';
  
  // Status left stripe color
  const statusStripe = isComplete ? 'bg-[var(--accent-warm)]' : isError ? 'bg-[var(--status-review)]' : 'bg-[var(--status-processing)]';

  // Extract Valuation
  const displayValue = (() => {
    if (!item.valuation) return null;
    const likelyMatch = item.valuation.match(/(?:Most Likely|Likely|eBay Sale)[^$]*(\$[\d,]+(?:\.\d{2})?)/i);
    if (likelyMatch) return likelyMatch[1];
    const rangeMatch = item.valuation.match(/(\$[\d,]+(?:\.\d{2})?)\s*[-–]\s*(\$[\d,]+(?:\.\d{2})?)/);
    if (rangeMatch) return `${rangeMatch[1]}–${rangeMatch[2]}`;
    const firstMatch = item.valuation.match(/\$[\d,]+(?:\.\d{2})?/);
    return firstMatch ? firstMatch[0] : null;
  })();

  // Image Classes
  const imageClasses = cn(
    "object-cover w-full h-full transition-luxury",
    isComplete ? "processing-complete" : isMidProcess ? "processing-mid" : "processing-grayscale"
  );

  return (
    <Link href={`/items/${item.id}`} className="block group w-full max-w-[320px] mx-auto">
      <motion.div 
        className="relative bg-[var(--surface-800)] rounded-[6px] overflow-hidden hover-lift flex flex-col min-h-[420px] satin-shadow border border-transparent hover:border-[var(--glass-01)]"
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
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-end p-4">
              {/* Scan Sweep Bar */}
              {isMidProcess && <div className="absolute inset-0 scan-sweep-bar pointer-events-none" />}
              
              <div className="flex bg-[var(--glass-02)] w-fit backdrop-blur-md px-2 py-1 rounded-[4px] items-center gap-2 border border-[var(--glass-01)]">
                <RefreshCw size={12} className="text-[var(--status-processing)] animate-spin" />
                <span className="text-[10px] font-medium text-[var(--status-processing)] uppercase tracking-widest">Processing</span>
              </div>
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
           </div>
           
           <div className="mt-4">
              {displayValue ? (
                <div className="text-[18px] font-bold text-[var(--accent-warm)] font-serif tracking-tight">
                    {displayValue}
                </div>
              ) : (
                <div className="text-[14px] text-[var(--text-300)] italic">
                    {isError ? "Error valuing" : "Analyzing..."}
                </div>
              )}
           </div>
        </div>
      </motion.div>
    </Link>
  );
}
