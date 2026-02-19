"use client";

import { useEffect, useState } from 'react';
import { UploadDropzone } from '@/components/UploadDropzone'; // Path might need correction
import { ItemCard } from '@/components/ItemCard';
import { Loader2, Search } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

// Inline utils if lib/utils doesn't exist yet/not standard
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn_inline(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Define Item type locally or import
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
  
  const fetchItems = async () => {
    try {
      const url = query ? `/api/items?q=${encodeURIComponent(query)}` : '/api/items';
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.data || []); // Handle { data: [], meta: ... } response structure
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Fetch & Poll
  useEffect(() => {
    fetchItems();
    
    // Poll for status updates every 5s if any items are processing
    const interval = setInterval(() => {
       // Ideally only poll if needed, but simple for now
       fetchItems();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [query]);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">PaperTrail Lite</h1>
                <p className="text-slate-500 dark:text-slate-400">Secure Ephemera Archiving System</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search receipts, dates, tags..." 
                    className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
        </div>

        {/* Upload Section */}
        <section>
            <UploadDropzone onUploadComplete={fetchItems} />
        </section>

        {/* Recent Items Grid */}
        <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                Recent Uploads
                {loading && <Loader2 className="animate-spin w-4 h-4 text-slate-400" />}
            </h2>
            
            {items.length === 0 && !loading ? (
                <div className="text-center py-20 text-slate-400">
                    No items found. Upload your first document!
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
