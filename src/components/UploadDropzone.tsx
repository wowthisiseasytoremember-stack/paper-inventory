"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function UploadDropzone({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    setProgress(10);

    let successCount = 0;
    let failCount = 0;

    for (const file of acceptedFiles) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name}: Too large (Max 25MB)`);
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
          throw new Error(error.error || 'Upload failed');
        }

        const data = await res.json();
        if (data.status === 'duplicate') {
          toast.info(`${file.name}: Already archived`);
        } else {
          successCount++;
        }
        setProgress(Math.min(90, 10 + (80 * (successCount + failCount) / acceptedFiles.length)));
      } catch (error: any) {
        console.error(error);
        toast.error(`${file.name}: ${error.message}`);
        failCount++;
      }
    }

    setProgress(100);
    
    if (successCount > 0) {
      toast.success(`${successCount} item${successCount > 1 ? 's' : ''} uploaded`, {
        description: "Processing started in background."
      });
    }
    
    if (onUploadComplete) onUploadComplete();

    setTimeout(() => {
      setIsUploading(false);
      setProgress(0);
    }, 500);
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
        "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all relative overflow-hidden",
        isDragActive ? "border-blue-500 bg-blue-500/5" : "border-slate-700 hover:border-slate-500 bg-slate-900/50",
        isUploading ? "opacity-60 cursor-not-allowed" : ""
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center justify-center gap-3">
        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        ) : (
          <UploadCloud className={cn("h-8 w-8 text-slate-500", isDragActive && "text-blue-400")} />
        )}
        
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-200">
            {isUploading ? "Uploading..." : "Drop images here or tap to select"}
          </p>
          <p className="text-xs text-slate-500">
            JPEG, PNG, WEBP — up to 25MB each — max 10 files
          </p>
        </div>
      </div>
      
      {isUploading && (
        <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
      )}
    </div>
  );
}
