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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-tighter uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 backdrop-blur-md">
          <CheckCircle size={8} strokeWidth={3} /> Ready
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-tighter uppercase bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertTriangle size={8} strokeWidth={3} /> Err
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-tighter uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
          <Clock size={8} strokeWidth={3} /> Sync
        </span>
      );
  }
};

export function ItemCard({ item }: { item: Item }) {
  return (
    <Link href={`/items/${item.id}`} className="block group">
      <motion.div 
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="relative border rounded-[1.2rem] overflow-hidden transition-luxury glass border-slate-800/40 hover:border-blue-500/30 shadow-xl h-full flex flex-col"
      >
        <div className="aspect-[1/1] bg-slate-950 relative flex items-center justify-center overflow-hidden border-b border-slate-800/50">
             {item.thumbnailPath ? (
                <img 
                    src={`/api/items/${item.id}/thumbnail`} 
                    alt={item.title || "Document"} 
                    className="object-cover w-full h-full group-hover:scale-110 transition-luxury duration-700 opacity-90 group-hover:opacity-100"
                    loading="lazy"
                />
             ) : (
                <FileText className="text-slate-800 w-6 h-6" />
             )}
             
             <div className="absolute top-1.5 right-1.5 z-10 scale-90 origin-top-right">
                <StatusBadge status={item.status} />
             </div>

             {item.valuation && (
               <div className="absolute bottom-1.5 left-1.5 z-10">
                  <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-xl border border-white/5 text-[9px] font-black text-emerald-400 flex items-center gap-1 shadow-2xl tracking-tighter">
                    <DollarSign size={8} strokeWidth={3} />
                    {item.valuation}
                  </div>
               </div>
             )}
        </div>
        
        <div className="p-3 flex-grow flex flex-col justify-end bg-slate-950/40">
            <h3 className="text-[11px] font-black truncate text-slate-200 mb-0.5 group-hover:text-blue-400 transition-colors tracking-tight" title={item.title}>
                {item.title || "..."}
            </h3>
            <div className="flex items-center justify-between text-[8px] font-bold text-slate-600 uppercase tracking-tighter font-mono">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                <div className="w-1 h-1 rounded-full bg-slate-800" />
            </div>
        </div>
      </motion.div>
    </Link>
  );
}
