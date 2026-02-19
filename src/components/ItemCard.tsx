"use client";

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns'; // Need to install date-fns
import { CheckCircle, Clock, FileText, AlertTriangle } from 'lucide-react';

interface Item {
  id: string;
  title?: string;
  status: string;
  thumbnailPath?: string; // We need to serve this via an API or static file
  createdAt: string;
  detectedType?: string; // Mime
}

// Map status to icons/colors
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'complete':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} /> Ready</span>;
    case 'error':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertTriangle size={12} /> Error</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse"><Clock size={12} /> Processing</span>;
  }
};

export function ItemCard({ item }: { item: Item }) {
  // Thumbnail serving: tricky with local files outside public.
  // We need a route like /api/items/[id]/thumbnail or just use a placeholder for now if robust serving isn't ready.
  // Implementation Plan says "Serve via Next.js Image Optimization or static"
  // Let's assume we can serve it later. For now, use a flexible placeholder.

  return (
    <Link href={`/items/${item.id}`} className="block group">
      <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className="aspect-[3/4] bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
             {/* Placeholder or Real Image */}
             {item.thumbnailPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                    src={`/api/items/${item.id}/thumbnail`} 
                    alt={item.title || "Document"} 
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                />
             ) : (
                <FileText className="text-slate-300 w-16 h-16" />
             )}
             
             <div className="absolute top-2 right-2">
                <StatusBadge status={item.status} />
             </div>
        </div>
        
        <div className="p-3">
            <h3 className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100" title={item.title}>
                {item.title || "Untitled Document"}
            </h3>
            <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                <span className="uppercase">{item.detectedType?.split('/')[1] || 'FILE'}</span>
            </div>
        </div>
      </div>
    </Link>
  );
}
