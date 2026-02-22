"use client";

import { useEffect, useState, useCallback } from 'react';
import { UploadDropzone } from '@/components/UploadDropzone';
import { ItemCard } from '@/components/ItemCard';
import { Loader2, Search, Archive, Plus } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

interface Item {
    id: string;
    title?: string;
    status: string;
    createdAt: string;
    thumbnailPath?: string;
}

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const url = query ? `/api/items?q=${encodeURIComponent(query)}` : '/api/items';
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchItems();
    
    // Only poll if items are actively processing
    const hasProcessing = items.some(i => !['complete', 'error'].includes(i.status));
    const interval = setInterval(fetchItems, hasProcessing ? 3000 : 15000);
    return () => clearInterval(interval);
  }, [query, fetchItems, items.length]);

  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">PaperTrail Lite</h1>
                    <p className="text-slate-500 text-sm">Secure Ephemera Archiving System</p>
                </div>
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors active:scale-95"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Upload</span>
                </button>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input 
                    id="search-input"
                    type="text" 
                    placeholder="Search documents..." 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
        </div>

        {/* Upload Section (Collapsible) */}
        {showUpload && (
          <section className="animate-in slide-in-from-top-2 duration-200">
              <UploadDropzone onUploadComplete={() => { fetchItems(); setShowUpload(false); }} />
          </section>
        )}

        {/* Items Grid */}
        <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-400 uppercase tracking-wider">
                Recent Uploads
                {loading && <Loader2 className="animate-spin w-3.5 h-3.5" />}
                {!loading && <span className="text-slate-600">({items.length})</span>}
            </h2>
            
            {items.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
                      <Archive className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-300 mb-1">No documents yet</h3>
                    <p className="text-slate-500 text-sm mb-6 max-w-xs">Upload your first receipt, letter, or historical paper to begin archiving.</p>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      <Plus size={16} /> Upload First Document
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {items.map(item => (
                        <ItemCard key={item.id} item={item} />
                    ))}
                </div>
            )}
        </section>
      </div>
      <Toaster />
    </main>
  );
}
