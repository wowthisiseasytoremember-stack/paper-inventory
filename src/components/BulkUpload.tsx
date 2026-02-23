"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';

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

  const uploadSingleFile = async (uf: UploadFile) => {
    try {
      const compressionOptions = {
        maxSizeMB: 5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        preserveExif: true,
      };

      let fileToUpload = uf.file;

      if (uf.file.type.startsWith('image/')) {
        try {
          const compressedBlob = await imageCompression(uf.file, compressionOptions);
          fileToUpload = new File([compressedBlob], uf.file.name, {
            type: compressedBlob.type,
            lastModified: uf.file.lastModified,
          });
        } catch (compressionError) {
          console.warn(`[Compression] Failed for ${uf.file.name}, using original.`);
        }
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setFiles(prev => prev.map(f => f.file === uf.file ? { ...f, status: 'success', id: data.id } : f));
    } catch (err: any) {
      setFiles(prev => prev.map(f => f.file === uf.file ? { ...f, status: 'error', error: err.message } : f));
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const newUploadFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading' as const,
      progress: 0
    }));

    setFiles(prev => [...prev, ...newUploadFiles]);

    // Fire uploads immediately — zero friction
    newUploadFiles.forEach(uf => uploadSingleFile(uf));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    }
  });

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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-[2rem] p-12 transition-luxury glass flex flex-col items-center justify-center gap-4 cursor-pointer outline-none",
          isDragActive ? "border-blue-500 bg-blue-500/5" : "border-slate-800 hover:border-slate-700",
          files.length > 0 ? "py-8" : "py-24"
        )}
      >
        <input {...getInputProps()} />
        <div className={cn("p-4 rounded-full bg-slate-900 border border-slate-800 transition-colors", isDragActive ? "text-blue-400 border-blue-500/50" : "text-slate-400 group-hover:text-blue-400")}>
          <Upload size={32} />
        </div>
        <div className="text-center pointer-events-none">
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
                    Uploading ({files.filter(f => f.status === 'success').length}/{files.length})
                </span>
                <span className="text-[9px] font-mono text-slate-600 tracking-tight">
                    auto-processing
                </span>
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
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
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
