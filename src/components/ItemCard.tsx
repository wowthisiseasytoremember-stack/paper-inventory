"use client";

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, FileText, AlertTriangle, RefreshCw, DollarSign } from 'lucide-react';
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

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'complete':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 backdrop-blur-md shadow-[0_0_10px_rgba(16,185,129,0.2)]">
          <CheckCircle size={10} strokeWidth={3} /> Ready
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-red-500/10 text-red-400 border border-red-500/20 backdrop-blur-md">
          <AlertTriangle size={10} strokeWidth={3} /> Error
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 backdrop-blur-md animate-pulse">
          <Clock size={10} strokeWidth={3} /> Syncing
        </span>
      );
  }
};

export function ItemCard({ item }: { item: Item }) {
  return (
    <Link href={`/items/${item.id}`} className="block group">
      <motion.div 
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        className="relative border rounded-[2rem] overflow-hidden transition-luxury glass border-slate-800/50 hover:border-blue-500/30 active:border-blue-500/50 shadow-2xl h-full flex flex-col"
      >
        {/* Image Container */}
        <div className="aspect-[4/5] bg-slate-950 relative flex items-center justify-center overflow-hidden border-b border-slate-800/50">
             {item.thumbnailPath ? (
                <img 
                    src={`/api/items/${item.id}/thumbnail`} 
                    alt={item.title || "Document"} 
                    className="object-cover w-full h-full group-hover:scale-110 transition-luxury duration-700 opacity-80 group-hover:opacity-100"
                    loading="lazy"
                />
             ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <FileText className="text-slate-700 w-8 h-8" />
                  </div>
                  {!['complete', 'error'].includes(item.status) && (
                    <div className="flex items-center gap-2 text-blue-500/50">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    </div>
                  )}
                </div>
             )}
             
             {/* Badge Overlay */}
             <div className="absolute top-3 right-3 z-10">
                <StatusBadge status={item.status} />
             </div>

             {/* Value Overlay */}
             {item.valuation && (
               <div className="absolute bottom-3 left-3 z-10">
                  <div className="px-3 py-1 rounded-lg bg-black/60 backdrop-blur-xl border border-white/5 text-[10px] font-black text-emerald-400 flex items-center gap-1 shadow-2xl">
                    <DollarSign size={10} strokeWidth={3} />
                    {item.valuation}
                  </div>
               </div>
             )}

             {/* Gradient Overlay */}
             <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/80 to-transparent opacity-60 pointer-events-none" />
        </div>
        
        {/* Details Container */}
        <div className="p-5 flex-grow flex flex-col justify-end bg-gradient-to-b from-transparent to-slate-950/50">
            <h3 className="text-sm font-black truncate text-slate-100 mb-1 group-hover:text-blue-400 transition-colors leading-tight" title={item.title}>
                {item.title || "Synthesizing..."}
            </h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800 group-hover:bg-blue-500 transition-colors" />
            </div>
        </div>
      </motion.div>
    </Link>
  );
}
