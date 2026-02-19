"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils'; // Assumes utils exist, if not I'll define it or use clsx directly

// Inline utils if lib/utils doesn't exist yet/not standard
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn_inline(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function UploadDropzone({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0); // For visual feedback if we had XHR progress

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large (Max 25MB)");
      return;
    }

    setIsUploading(true);
    setProgress(10); // Fake start

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await res.json();
      setProgress(100);
      toast.success("Upload successful!", {
        description: "Your item is now processing in the background."
      });
      
      if (onUploadComplete) onUploadComplete();

    } catch (error: any) {
      console.error(error);
      toast.error("Upload failed", {
        description: error.message
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
      'image/heic': []
    },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div
      {...getRootProps()}
      className={cn_inline(
        "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors relative overflow-hidden",
        isDragActive ? "border-blue-500 bg-blue-50/10" : "border-slate-300 hover:border-slate-400",
        isUploading ? "opacity-50 cursor-not-allowed" : ""
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center justify-center gap-4">
        {isUploading ? (
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        ) : (
          <UploadCloud className={cn_inline("h-10 w-10 text-slate-400", isDragActive && "text-blue-500")} />
        )}
        
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {isUploading ? "Uploading..." : "Click or drag to upload receipt"}
          </p>
          <p className="text-xs text-slate-500">
            JPEG, PNG, WEBP up to 25MB
          </p>
        </div>
      </div>
      
      {/* Visual Progress Bar (Fake) */}
      {isUploading && (
        <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      )}
    </div>
  );
}
