"use client";

import React, { useState, useEffect } from 'react';
import {
  Bug, X, Play, Trash2, Terminal, RefreshCw, StickyNote,
  ChevronDown, ChevronUp, Zap, FlaskConical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';

interface ModelConfig {
  baseline: string[];
  deepDive: string[];
  grounding: string[];
}

const LS_KEY = 'debug-fab-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to load settings:', err);
    return null;
  }
}

function saveSettings(s: any) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-blue-300 outline-none focus:ring-1 focus:ring-blue-500/30"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function DebugFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [models, setModels] = useState<ModelConfig>({ baseline: [], deepDive: [], grounding: [] });
  const [baselineModel, setBaselineModel] = useState('gemini-2.0-flash');
  const [deepDiveModel, setDeepDiveModel] = useState('gemini-2.5-flash');
  const [enableGrounding, setEnableGrounding] = useState(true);
  const params = useParams();
  const itemId = params?.id as string;

  useEffect(() => {
    const saved = loadSettings();
    if (saved) {
      setBaselineModel(saved.baselineModel || 'gemini-2.0-flash');
      setDeepDiveModel(saved.deepDiveModel || 'gemini-2.5-flash');
      setEnableGrounding(saved.enableGrounding ?? true);
    }

    (async () => {
      try {
        const res = await fetch('/api/debug/log');
        const data = await res.json();
        if (data.prompt) {
          setDefaultPrompt(data.prompt);
          setPrompt(prev => prev || data.prompt);
        }
        if (data.models) setModels(data.models);
        if (!saved && data.defaults) {
          setBaselineModel(data.defaults.baselineModel);
          setDeepDiveModel(data.defaults.deepDiveModel);
          setEnableGrounding(data.defaults.enableGrounding);
        }
      } catch (err) {
        console.error("Failed to load debug config", err);
      }
    })();
  }, []);

  useEffect(() => {
    saveSettings({ baselineModel, deepDiveModel, enableGrounding });
  }, [baselineModel, deepDiveModel, enableGrounding]);

  const handleRetryWithPrompt = async () => {
    if (!itemId) {
      toast.error("Navigate to an item to retry with custom prompt");
      return;
    }

    setIsRetrying(true);
    const toastId = toast.loading('Running AI pipeline...', {
      description: `Baseline: ${baselineModel} → Deep Dive: ${deepDiveModel}`
    });

    try {
      const res = await fetch(`/api/items/${itemId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt !== defaultPrompt ? prompt : undefined,
          baselineModel,
          deepDiveModel,
          enableGrounding,
        })
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      toast.success(`Done — ${data.category}${data.groundingUsed ? ' + grounded' : ''}`, { id: toastId });
      window.location.reload();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`, { id: toastId });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
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
            animate={{ opacity: 1, scale: 1, y: 0, x: 0, height: isMinimized ? 'auto' : '580px' }}
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
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 transition-colors">
                  {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </header>

            {!isMinimized && (
              <>
                <div className="flex-grow overflow-hidden flex flex-col p-4 space-y-3">
                  {/* Model Controls */}
                  <div className="flex items-center gap-1 mb-1">
                    <FlaskConical size={10} className="text-purple-400" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">A/B Model Selection</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Baseline"
                      value={baselineModel}
                      options={models.baseline.length > 0 ? models.baseline : ['gemini-2.0-flash', 'gpt-4o-mini', 'gpt-4o']}
                      onChange={setBaselineModel}
                    />
                    <Select
                      label="Deep Dive"
                      value={deepDiveModel}
                      options={models.deepDive.length > 0 ? models.deepDive : ['gemini-2.5-flash', 'claude-sonnet', 'groq']}
                      onChange={setDeepDiveModel}
                    />
                  </div>

                  {/* Grounding Toggle */}
                  <button
                    onClick={() => setEnableGrounding(!enableGrounding)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all",
                      enableGrounding
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-slate-950 border-slate-800 text-slate-600"
                    )}
                  >
                    <Zap size={10} />
                    Google Search Grounding: {enableGrounding ? 'ON' : 'OFF'}
                  </button>

                  {/* Prompt Override */}
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <StickyNote size={10} className="text-blue-500" /> System Prompt Override
                    </label>
                    <button
                      onClick={() => setPrompt(defaultPrompt)}
                      className="text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-tighter"
                    >
                      Reset
                    </button>
                  </div>

                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Instructions..."
                    className="flex-grow w-full bg-slate-950 border border-slate-900 rounded-xl p-3 text-[11px] font-mono text-blue-300 placeholder-slate-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all custom-scrollbar resize-none"
                  />
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-900/30 border-t border-slate-800 space-y-2">
                  {itemId ? (
                    <button
                      onClick={handleRetryWithPrompt}
                      disabled={isRetrying}
                      className="w-full h-11 group flex items-center justify-center gap-2 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-500 transition-luxury shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isRetrying ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                      RUN PIPELINE
                    </button>
                  ) : (
                    <div className="py-3 px-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center">
                      <p className="text-[9px] font-bold text-slate-600 italic uppercase tracking-widest leading-tight">
                        Open an item to enable<br/>pipeline controls
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
                      <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">
                        {baselineModel} → {deepDiveModel}
                      </span>
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
