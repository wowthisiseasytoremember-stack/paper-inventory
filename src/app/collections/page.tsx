"use client";

import { useEffect, useState } from 'react';
import { 
  FolderPlus, 
  ChevronRight, 
  Database, 
  Trash2,
  LayoutGrid,
  Layers3
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Collection {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  itemCount?: number;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      if (!res.ok) throw new Error('Failed to load collections');
      const data = await res.json();
      setCollections(data);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
      toast.error('Vault connection interrupted');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc })
      });
      if (!res.ok) throw new Error('Creation failed');
      toast.success('New niche collection established');
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      fetchCollections();
    } catch (err) {
      toast.error('Failed to establish collection');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? Items will be unlinked but not deleted.')) return;
    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');
      toast.success('Collection dismantled');
      fetchCollections();
    } catch (err) {
      console.error('Failed to delete collection:', err);
      toast.error('Dismantling failed');
    }
  };

  return (
    <div className="p-8 md:p-12 lg:p-16 space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-2xl">
                <Layers3 size={20} className="text-slate-950" strokeWidth={3} />
              </div>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-[0.2em] mt-1">Portfolio Organization</p>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter leading-none">Archival Sequences</h1>
            <p className="text-slate-500 text-sm max-w-md font-medium">Group your inventory by historical era, auction niche, or specialized collector interest.</p>
          </div>
          <button 
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-3 px-6 py-2.5 bg-white text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98] shadow-xl shadow-white/5"
          >
            <FolderPlus size={16} />
            ESTABLISH NEW SEQUENCE
          </button>
        </header>

        {/* Collection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           <AnimatePresence mode="popLayout">
            {collections.map((c, i) => (
              <motion.div 
                key={c.id}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                layout
                className="group relative"
              >
                <Link href={`/collections/${c.id}`} className="block h-full">
                  <div className="h-full bg-slate-900/20 hover:bg-white/[0.03] rounded-2xl p-8 border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col gap-6 shadow-inner text-left">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/10 group-hover:scale-110 transition-transform">
                        <Database size={20} />
                    </div>
                    
                    <div className="space-y-2">
                       <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{c.name}</h3>
                       <p className="text-slate-500 text-xs font-medium line-clamp-2 leading-relaxed h-8">
                          {c.description || "No archival notes established for this sequence."}
                       </p>
                    </div>

                    <div className="pt-6 border-t border-white/5 mt-auto flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="space-y-0.5">
                             <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Inventory</p>
                             <p className="text-xs font-bold text-white tracking-tight">-- UNITS</p>
                          </div>
                          <div className="w-[1px] h-6 bg-white/5" />
                          <div className="space-y-0.5">
                             <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Modified</p>
                             <p className="text-xs font-bold text-white tracking-tight">
                                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: false })} ago
                             </p>
                          </div>
                       </div>
                       <ChevronRight size={16} className="text-slate-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
                
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(c.id);
                  }}
                  className="absolute top-6 right-6 p-2 rounded-lg bg-slate-950 text-slate-700 hover:text-red-500 border border-white/5 hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                >
                   <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
           </AnimatePresence>

           {collections.length === 0 && !loading && (
             <div className="col-span-full py-32 flex flex-col items-center justify-center text-center space-y-6 rounded-2xl border border-dashed border-white/5 bg-white/[0.01]">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-slate-700">
                   <LayoutGrid size={32} />
                </div>
                <div className="space-y-2">
                   <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest">Archival Void</h3>
                   <p className="text-xs text-slate-600 font-medium">No sequences have been established in this vault.</p>
                </div>
                <button 
                  onClick={() => setShowCreate(true)}
                  className="px-6 py-2.5 bg-blue-600/10 text-blue-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-500/20 hover:bg-blue-600/20 transition-all"
                >
                  INITIALIZE FIRST SEQUENCE
                </button>
             </div>
           )}
        </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreate && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-left">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCreate(false)}
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.98, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.98, opacity: 0, y: 10 }}
                className="relative bg-slate-900 w-full max-w-lg rounded-xl p-10 border border-white/10 shadow-2xl space-y-8"
              >
                 <div className="space-y-2 text-center">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Establish Sequence</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Define a new niche for high-end grouping</p>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] px-1">Sequence Designation</label>
                       <input 
                          autoFocus
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. 19th Century Correspondence"
                          className="w-full bg-slate-950 border border-white/5 rounded-lg px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all shadow-inner"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] px-1">Scope / Archival Notes</label>
                       <textarea 
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                          placeholder="Describe the scope for the AI researcher..."
                          rows={3}
                          className="w-full bg-slate-950 border border-white/5 rounded-lg px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all resize-none shadow-inner"
                       />
                    </div>
                 </div>

                 <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => setShowCreate(false)}
                      className="flex-1 py-3 bg-slate-800 text-slate-400 text-[10px] font-black rounded-lg hover:bg-slate-700 transition-all uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="flex-1 py-3 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-500 transition-all disabled:opacity-50 uppercase tracking-widest shadow-xl shadow-blue-500/20"
                    >
                      ESTABLISH
                    </button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
