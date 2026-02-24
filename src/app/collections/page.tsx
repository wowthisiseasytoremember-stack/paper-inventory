"use client";

import { useEffect, useState } from 'react';
import { 
  Plus, 
  FolderPlus, 
  ChevronRight, 
  Database, 
  Trash2,
  Tag,
  Clock,
  LayoutGrid,
  Search,
  ArrowRight,
  MoreVertical,
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
      
      // For each collection, fetch item count (simulated or real if API supports)
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
    <main className="min-h-screen bg-slate-950 p-8 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 rounded-xl border border-blue-500/20">
                <Layers3 size={20} className="text-blue-500" />
              </div>
              <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.4em]">Portfolio Organization</p>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">Niche Collections</h1>
            <p className="text-slate-500 text-sm max-w-md">Group your inventory by historical era, auction niche, or specialized collector interest.</p>
          </div>
          <button 
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-3 px-8 py-4 bg-white text-slate-950 text-xs font-black rounded-2xl hover:bg-blue-50 transition-all active:scale-95 shadow-xl shadow-white/5"
          >
            <FolderPlus size={18} />
            ESTABLISH NEW COLLECTION
          </button>
        </header>

        {/* Collection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           <AnimatePresence mode="popLayout">
            {collections.map((c, i) => (
              <motion.div 
                key={c.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                layout
                className="group relative"
              >
                <Link href={`/collections/${c.id}`} className="block">
                  <div className="glass h-full bg-slate-900/40 hover:bg-slate-900/60 rounded-[2.5rem] p-10 border border-white/5 hover:border-blue-500/30 transition-all duration-500 flex flex-col gap-6 group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                    <div className="flex justify-between items-start">
                       <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20 group-hover:scale-110 transition-transform">
                          <Database size={24} />
                       </div>
                    </div>
                    
                    <div className="space-y-2">
                       <h3 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{c.name}</h3>
                       <p className="text-slate-500 text-sm font-medium line-clamp-2 leading-relaxed h-10">
                          {c.description || "No archival notes established for this niche."}
                       </p>
                    </div>

                    <div className="pt-6 border-t border-white/5 mt-auto flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="space-y-0.5">
                             <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Inventory</p>
                             <p className="text-sm font-bold text-white tracking-tight">-- UNITS</p>
                          </div>
                          <div className="w-[1px] h-6 bg-white/5" />
                          <div className="space-y-0.5">
                             <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Modified</p>
                             <p className="text-sm font-bold text-white tracking-tight">
                                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: false })} ago
                             </p>
                          </div>
                       </div>
                       <ChevronRight className="text-slate-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
                
                {/* Independent Actions (Dropdown or context menu overlay) */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(c.id);
                  }}
                  className="absolute top-8 right-8 p-3 rounded-xl bg-slate-950 text-slate-700 hover:text-red-500 border border-white/5 hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                >
                   <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
           </AnimatePresence>

           {collections.length === 0 && !loading && (
             <div className="col-span-full py-32 flex flex-col items-center justify-center text-center space-y-6 glass rounded-[3rem] border-dashed border-white/5">
                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-slate-700">
                   <LayoutGrid size={40} />
                </div>
                <div className="space-y-2">
                   <h3 className="text-xl font-bold text-slate-400">Archival Void</h3>
                   <p className="text-sm text-slate-600">You haven't established any niche collections yet.</p>
                </div>
                <button 
                  onClick={() => setShowCreate(true)}
                  className="px-8 py-3 bg-blue-600/10 text-blue-500 text-xs font-black rounded-2xl border border-blue-500/20 hover:bg-blue-600/20 transition-all"
                >
                  START FIRST COLLECTION
                </button>
             </div>
           )}
        </div>
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreate && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCreate(false)}
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                className="relative glass w-full max-w-lg rounded-[3rem] p-10 md:p-12 border border-white/10 shadow-3xl space-y-8"
              >
                 <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white">Establish Collection</h2>
                    <p className="text-sm text-slate-500">Define a new niche for high-end grouping.</p>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1">Niche Name</label>
                       <input 
                          autoFocus
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. 19th Century Correspondence"
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1">Scope / Archival Notes</label>
                       <textarea 
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                          placeholder="Describe the scope for the AI researcher..."
                          rows={3}
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:border-blue-500 outline-none transition-all resize-none"
                       />
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setShowCreate(false)}
                      className="flex-1 py-4 bg-slate-800 text-slate-400 text-xs font-black rounded-2xl hover:bg-slate-700 transition-all uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="flex-1 py-4 bg-blue-600 text-white text-xs font-black rounded-2xl hover:bg-blue-500 transition-all disabled:opacity-50 uppercase tracking-widest shadow-xl shadow-blue-500/20"
                    >
                      ESTABLISH
                    </button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </main>
  );
}
