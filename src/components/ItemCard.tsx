"use client";

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, FileText, AlertTriangle, RefreshCw } from 'lucide-react';

interface Item {
  id: string;
  title?: string;
  status: string;
  thumbnailPath?: string;
  createdAt: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'complete':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/50 text-emerald-400 border border-emerald-800/50"><CheckCircle size={10} /> Ready</span>;
    case 'error':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-900/50 text-red-400 border border-red-800/50"><AlertTriangle size={10} /> Error</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-900/50 text-blue-400 border border-blue-800/50 animate-pulse"><Clock size={10} /> {status.replace(/_/g, ' ')}</span>;
  }
};

export function ItemCard({ item }: { item: Item }) {
  return (
    <Link href={`/items/${item.id}`} className="block group">
      <div className="border rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all bg-slate-900 border-slate-800 hover:border-slate-700 active:scale-[0.98]">
        <div className="aspect-[3/4] bg-slate-800 relative flex items-center justify-center overflow-hidden">
             {item.thumbnailPath ? (
                <img 
                    src={`/api/items/${item.id}/thumbnail`} 
                    alt={item.title || "Document"} 
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                />
             ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="text-slate-600 w-10 h-10" />
                  {!['complete', 'error'].includes(item.status) && (
                    <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                  )}
                </div>
             )}
             
             <div className="absolute top-1.5 right-1.5">
                <StatusBadge status={item.status} />
             </div>
        </div>
        
        <div className="p-2.5">
            <h3 className="text-xs font-semibold truncate text-slate-200" title={item.title}>
                {item.title || "Processing..."}
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </p>
        </div>
      </div>
    </Link>
  );
}
