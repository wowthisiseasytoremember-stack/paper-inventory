"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Tag, 
  Database, 
  LayoutGrid,
  Search,
  ChevronRight,
  ExternalLink,
  History,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Item {
  id: string;
  title: string;
  thumbnailPath?: string;
  status: string;
  valuation?: string;
  createdAt: string;
}

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

  const fetchData = async () => {
    try {
      // 1. Fetch Collection Info
      const cRes = await fetch(`/api/collections`);
      const collections = await cRes.json();
      const found = collections.find((c: any) => c.id === id);
      if (!found) throw new Error('Collection not found');
      setCollection(found);

      // 2. Fetch Items (Currently we don't have a direct "get items by collection" API endpoint)
      // I'll create one or filter all items if count is small.
      // Better: Create /api/collections/[id]/items
      const iRes = await fetch(`/api/collections/${id}/items`);
      if (iRes.ok) {
        const data = await iRes.json();
        setItems(data);
      }
    } catch (err) {
      toast.error('Could not retrieve collection sequence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
       <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500" />
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 p-8 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex flex-col gap-6">
           <button 
              onClick={() => router.push('/collections')}
              className="group flex items-center gap-3 w-fit"
           >
              <div className="p-2 rounded-xl glass hover:bg-white/10 transition-all group-hover:-translate-x-1">
                 <ArrowLeft size={16} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white">Back to Collections</span>
           </button>
           
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-600/10 rounded-xl border border-blue-500/20">
                    <Database size={20} className="text-blue-500" />
                 </div>
                 <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">{collection?.name}</h1>
              </div>
              <p className="text-slate-500 text-sm max-w-2xl font-medium leading-relaxed italic">
                 {collection?.description || "No archival notes established for this sequence."}
              </p>
           </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {items.map((item, i) => (
             <motion.div
               key={item.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.05 }}
             >
                <Link href={`/items/${item.id}`}>
                  <div className="glass group overflow-hidden rounded-[2.5rem] border border-white/5 hover:border-blue-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 h-full flex flex-col">
                     <div className="aspect-[4/3] relative overflow-hidden bg-slate-900 flex items-center justify-center">
                        <img 
                          src={`/api/items/${item.id}/image`} 
                          alt={item.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                        <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-xl border border-white/5 text-[9px] font-black text-white/50 uppercase tracking-widest">
                           {item.status.replace(/_/g, ' ')}
                        </div>
                     </div>
                     <div className="p-6 space-y-4 flex-1 flex flex-col">
                        <h4 className="font-bold text-slate-200 line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">{item.title}</h4>
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                           <div className="text-[10px] font-black text-emerald-400 tabular-nums">
                              {item.valuation || "--"}
                           </div>
                           <ChevronRight size={14} className="text-slate-700 group-hover:translate-x-1 transition-transform" />
                        </div>
                     </div>
                  </div>
                </Link>
             </motion.div>
           ))}

           {items.length === 0 && (
              <div className="col-span-full py-32 text-center space-y-6 glass rounded-[3rem] border-dashed border-white/10 opacity-30">
                 <Search className="w-12 h-12 mx-auto text-slate-800" />
                 <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-600">No items assigned to this sequence</p>
              </div>
           )}
        </div>
      </div>
    </main>
  );
}
