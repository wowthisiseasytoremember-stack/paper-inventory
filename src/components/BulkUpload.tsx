"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UploadFile {
  file: File;
  previewUrl: string;
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  id?: string;
}

export function BulkUpload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(f => f.type.startsWith('image/'));
    if (validFiles.length < newFiles.length) {
        toast.error("Invalid files ignored. Only image files are supported.");
    }

    setFiles(prev => [
      ...prev,
      ...validFiles.map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'idle' as const,
        progress: 0
      }))
    ]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  const uploadFiles = async () => {
    const idleFiles = files.filter(f => f.status === 'idle');
    if (idleFiles.length === 0) return;

    // Process sequentially or with p-limit if we had it, 
    // but here we can just map them to separate upload calls.
    const uploadFile = async (index: number) => {
      const f = files[index];
      setFiles(prev => prev.map((item, i) => i === index ? { ...item, status: 'uploading' } : item));

      try {
        const formData = new FormData();
        formData.append('file', f.file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        setFiles(prev => prev.map((item, i) => i === index ? { ...item, status: 'success', id: data.id } : item));
      } catch (err: any) {
        setFiles(prev => prev.map((item, i) => i === index ? { ...item, status: 'error', error: err.message } : item));
      }
    };

    // Trigger all idle uploads
    const idleIndices = files.map((f, i) => f.status === 'idle' ? i : -1).filter(i => i !== -1);
    await Promise.all(idleIndices.map(uploadFile));

    toast.success("Bulk upload complete", {
        description: `Successfully queued ${files.filter(f => f.status === 'success').length} items.`,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div
        className={cn(
          "relative border-2 border-dashed rounded-[2rem] p-12 transition-luxury glass flex flex-col items-center justify-center gap-4 cursor-pointer",
          isDragging ? "border-blue-500 bg-blue-500/5" : "border-slate-800 hover:border-slate-700",
          files.length > 0 ? "py-8" : "py-24"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-blue-400 transition-colors">
          <Upload size={32} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black tracking-tight text-white mb-1">
            Bulk Archive Unit Ingest
          </h3>
          <p className="text-slate-500 text-sm font-medium">
            Drag & drop images or click to browse
          </p>
        </div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Queue ({files.length} items)
                </span>
                <button 
                    onClick={uploadFiles}
                    disabled={!files.some(f => f.status === 'idle')}
                    className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest transition-luxury shadow-lg shadow-blue-500/20"
                >
                    Process All
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl glass border border-slate-800/50 bg-slate-950/20 group relative">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-800">
                    <img
                      src={f.previewUrl}
                      alt="preview"
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-[11px] font-bold text-slate-300 truncate tracking-tight">{f.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {f.status === 'uploading' && <Loader2 size={10} className="animate-spin text-blue-500" />}
                      {f.status === 'success' && <CheckCircle size={10} className="text-emerald-500" />}
                      {f.status === 'error' && <AlertCircle size={10} className="text-red-500" />}
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-tighter font-mono",
                        f.status === 'idle' ? "text-slate-600" :
                        f.status === 'uploading' ? "text-blue-500" :
                        f.status === 'success' ? "text-emerald-500" : "text-red-500"
                      )}>
                        {f.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 rounded-full hover:bg-slate-800 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-luxury"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
