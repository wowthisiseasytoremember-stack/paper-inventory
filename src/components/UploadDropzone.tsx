"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2, Sparkles, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function UploadDropzone({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    setProgress(5);

    let successCount = 0;
    let failCount = 0;

    for (const file of acceptedFiles) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name}: Exceeds 25MB limit`);
        failCount++;
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Fault in transmission');
        }

        const data = await res.json();
        if (data.status === 'duplicate') {
          toast.info(`${file.name}: Unit already in vault`);
        } else {
          successCount++;
        }
        setProgress(Math.min(95, 5 + (90 * (successCount + failCount) / acceptedFiles.length)));
      } catch (error: any) {
        console.error(error);
        toast.error(`${file.name}: ${error.message}`);
        failCount++;
      }
    }

    setProgress(100);
    
    if (successCount > 0) {
      toast.success(`${successCount} unit${successCount > 1 ? 's' : ''} initialized`, {
        description: "AI synthesis started in the isolation zone."
      });
    }
    
    if (onUploadComplete) onUploadComplete();

    setTimeout(() => {
      setIsUploading(false);
      setProgress(0);
    }, 800);
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
      'image/heic': []
    },
    maxFiles: 10,
    disabled: isUploading
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative rounded-[2.5rem] border-2 border-dashed p-12 transition-luxury cursor-pointer overflow-hidden",
        isDragActive 
          ? "border-blue-500 bg-blue-500/10 shadow-[inner_0_0_20px_rgba(59,130,246,0.1)] scale-[1.01]" 
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 shadow-2xl",
        isUploading ? "opacity-60 cursor-not-allowed pointer-events-none" : ""
      )}
    >
      <input {...getInputProps()} />
      
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          {isUploading ? (
            <div className="relative flex items-center justify-center">
              <Loader2 className="h-16 w-16 animate-spin text-blue-500" strokeWidth={1.5} />
              <ShieldCheck className="absolute h-6 w-6 text-blue-400 animate-pulse" />
            </div>
          ) : (
            <div className={cn(
              "p-6 rounded-[2rem] bg-slate-950 border border-slate-800 shadow-xl transition-luxury",
              isDragActive ? "border-blue-500 scale-110 shadow-blue-500/20" : "group-hover:border-slate-700 group-hover:scale-105"
            )}>
              <UploadCloud className={cn(
                "h-10 w-10 text-slate-600 transition-luxury group-hover:text-blue-400",
                isDragActive && "text-blue-500"
              )} />
            </div>
          )}
        </div>
        
        <div className="text-center space-y-3">
          <h3 className="text-xl font-black text-white tracking-tight">
            {isUploading ? "Initializing Secure Transmission..." : "Archival Entry Point"}
          </h3>
          <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto">
            {isUploading 
              ? `Syncing to secure isolation zone...`
              : "Drop high-fidelity scans or tap to browse the sequence. Gemini 2.0 Pro will synthesize metadata."}
          </p>
          
          <div className="flex items-center justify-center gap-3 pt-4">
            <span className="px-3 py-1 bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-600 rounded-lg border border-slate-900">MAX 25MB</span>
            <span className="px-3 py-1 bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-600 rounded-lg border border-slate-900">BATCH: 10</span>
          </div>
        </div>
      </div>
      
      {/* HUD-style progress bar */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 4 }}
            className="absolute bottom-0 left-0 w-full bg-slate-950 overflow-hidden"
          >
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: `${progress - 100}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              className="w-full h-full bg-blue-600"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
