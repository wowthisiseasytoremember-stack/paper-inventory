"use client";

import React, { useState, useEffect } from 'react';
import { 
  Bug, 
  X, 
  Play, 
  Trash2, 
  Terminal, 
  Sparkles,
  RefreshCw,
  StickyNote,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';

export function DebugFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const params = useParams();
  const itemId = params?.id as string;

  useEffect(() => {
    const loadDefault = async () => {
       try {
         const res = await fetch('/api/debug/log');
         const data = await res.json();
         if (data.prompt) {
           setDefaultPrompt(data.prompt);
           // Only set current prompt if it's empty
           setPrompt(prev => prev || data.prompt);
         }
       } catch (err) {
         console.error("Failed to load default prompt", err);
       }
    };
    loadDefault();
  }, []);

  const handleRetryWithPrompt = async () => {
    if (!itemId) {
      toast.error("Navigate to an item to retry with custom prompt");
      return;
    }

    setIsRetrying(true);
    const toastId = toast.loading('Executing with custom prompt...', {
      description: 'Check ai-prompt-debug.txt for logs.'
    });

    try {
      const res = await fetch(`/api/items/${itemId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt || undefined })
      });

      if (!res.ok) throw new Error(await res.text());
      
      toast.success('Analysis updated with custom prompt', { id: toastId });
      // We don't reload the whole page, we let the item details poll or just trigger a manual refresh if we had a refetch function
      // For now, reload is safest to see all UI changes, but let's try to just Toast success.
      window.location.reload();
    } catch (err: any) {
      toast.error(`Retry failed: ${err.message}`, { id: toastId });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-[100]">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 text-white border border-blue-400/20"
          >
            <Bug size={24} />
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0, 
              x: 0,
              height: isMinimized ? 'auto' : '500px'
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            className={cn(
              "fixed bottom-6 right-6 w-96 glass border border-slate-800 rounded-[2rem] shadow-3xl z-[120] overflow-hidden flex flex-col",
              isMinimized && "w-64"
            )}
          >
            {/* Header */}
            <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-blue-400" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Neural Console</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)} 
                  className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 transition-colors"
                >
                  {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {!isMinimized && (
              <>
                {/* Content */}
                <div className="flex-grow overflow-hidden flex flex-col p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <StickyNote size={10} className="text-blue-500" /> System Prompt Override
                    </label>
                    <button 
                      onClick={() => setPrompt(defaultPrompt)}
                      className="text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-tighter"
                    >
                      Reset to Default
                    </button>
                  </div>
                  
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Instructions..."
                    className="flex-grow w-full bg-slate-950 border border-slate-900 rounded-xl p-3 text-[11px] font-mono text-blue-300 placeholder-slate-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all custom-scrollbar resize-none"
                  />
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-900/30 border-t border-slate-800 space-y-2">
                  {itemId ? (
                    <button
                      onClick={handleRetryWithPrompt}
                      disabled={isRetrying}
                      className="w-full h-11 group flex items-center justify-center gap-2 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-500 transition-luxury shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isRetrying ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                      RUN CUSTOM PROMPT
                    </button>
                  ) : (
                    <div className="py-3 px-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center">
                      <p className="text-[9px] font-bold text-slate-600 italic uppercase tracking-widest leading-tight">
                        Open an item to enable<br/>prompt overrides
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPrompt('')}
                      className="flex-1 py-2 px-3 bg-slate-800 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-luxury flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                    <div className="flex-1 flex items-center justify-center bg-slate-950/50 border border-slate-800 rounded-lg">
                       <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">Logging Active</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
