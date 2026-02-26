"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Database, 
  ChevronRight,
  Search
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useItemStore } from '@/store/itemStore';
import { ItemDetailModal } from '@/components/ItemDetailModal';
import type { Item } from '@/lib/db/items';

interface Collection {
  id: string;
  name: string;
  description?: string;
}

export default function CollectionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const setSelectedItemId = useItemStore(state => state.setSelectedItemId);

  const fetchData = async () => {
    try {
      const [cRes, iRes] = await Promise.all([
        fetch(`/api/collections/${id}`),
        fetch(`/api/collections/${id}/items`),
      ]);
      if (!cRes.ok) throw new Error('Collection not found');
      setCollection(await cRes.json());
      if (iRes.ok) setItems(await iRes.json());
    } catch (err) {
      console.error("Error fetching collection data:", err);
      toast.error('Could not retrieve collection sequence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading) return (
    <div className="h-full w-full flex items-center justify-center bg-slate-950">
       <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500" />
    </div>
  );

  return (
    <div className="p-8 md:p-12 lg:p-16 space-y-12">
        <header className="flex flex-col gap-8">
           <button 
              onClick={() => router.push('/collections')}
              className="group flex items-center gap-3 w-fit"
           >
              <div className="p-2 rounded-lg bg-white/5 border border-white/5 group-hover:bg-white/10 transition-all group-hover:-translate-x-1">
                 <ArrowLeft size={14} className="text-slate-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">Return to Sequences</span>
           </button>
           
           <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/10">
                    <Database size={24} />
                 </div>
                 <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">{collection?.name}</h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Active Archival Sequence</p>
                 </div>
              </div>
              <p className="text-slate-400 text-sm max-w-2xl font-medium leading-relaxed italic border-l-2 border-white/5 pl-6">
                 {collection?.description || "No archival notes established for this sequence."}
              </p>
           </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
           {items.map((item, i) => (
             <motion.div
               key={item.id}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.03 }}
             >
                <div 
                  onClick={() => setSelectedItemId(item.id)}
                  className="group cursor-pointer h-full"
                >
                  <div className="bg-slate-900/20 hover:bg-white/[0.03] rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-300 h-full flex flex-col overflow-hidden shadow-inner">
                     <div className="aspect-[4/3] relative overflow-hidden bg-slate-950">
                        <img 
                          src={`/api/items/${item.id}/image`} 
                          alt={item.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-40 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                        <div className="absolute top-4 right-4 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white/70 uppercase tracking-widest border border-white/5">
                           {item.status.replace(/_/g, ' ')}
                        </div>
                     </div>
                     <div className="p-6 space-y-4 flex-1 flex flex-col">
                        <h4 className="font-bold text-slate-300 text-sm line-clamp-2 leading-snug group-hover:text-white transition-colors">{item.title}</h4>
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                           <div className="text-[10px] font-black text-emerald-500 tabular-nums tracking-tight">
                              {item.valuation ? `$${item.valuation}` : "--"}
                           </div>
                           <ChevronRight size={14} className="text-slate-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </div>
                     </div>
                  </div>
                </div>
             </motion.div>
           ))}

           {items.length === 0 && (
              <div className="col-span-full py-32 flex flex-col items-center justify-center text-center space-y-6 rounded-2xl border border-dashed border-white/5 bg-white/[0.01]">
                 <Search className="w-12 h-12 mx-auto text-slate-800" />
                 <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">No units assigned to this sequence</p>
              </div>
           )}
        </div>
      </div>
      <ItemDetailModal />
    </div>
  );
}
