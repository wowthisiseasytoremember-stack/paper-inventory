"use client";

import React, { useState, useRef, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BespokeMagnifierProps {
  src: string;
  alt: string;
  className?: string;
  zoomLevel?: number;
  onLoad?: () => void;
}

export function BespokeMagnifier({ 
  src, 
  alt, 
  className, 
  zoomLevel = 2.5,
  onLoad
}: BespokeMagnifierProps) {
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [imgBounds, setImgBounds] = useState({ width: 0, height: 0 });
  
  const imgRef = useRef<HTMLImageElement>(null);

  const handleMouseMove = (e: MouseEvent) => {
    if (!imgRef.current) return;

    const { top, left, width, height } = imgRef.current.getBoundingClientRect();
    const x = e.pageX - left - window.scrollX;
    const y = e.pageY - top - window.scrollY;

    setCursorPos({ x, y });
    setImgBounds({ width, height });
    
    // Calculate position for the background image inside the magnifier
    const posX = (x / width) * 100;
    const posY = (y / height) * 100;
    
    setMagnifierPos({ x: posX, y: posY });
  };

  return (
    <div className={cn("relative group cursor-crosshair overflow-hidden rounded-[2.5rem]", className)}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="w-full h-auto block transition-all duration-700"
        onLoad={onLoad}
        onMouseEnter={() => setShowMagnifier(true)}
        onMouseLeave={() => setShowMagnifier(false)}
        onMouseMove={handleMouseMove}
      />

      <AnimatePresence>
        {showMagnifier && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute pointer-events-none z-50 border-2 border-white/20 shadow-2xl overflow-hidden rounded-full backdrop-blur-3xl"
            style={{
              width: 200,
              height: 200,
              left: cursorPos.x - 100,
              top: cursorPos.y - 100,
              backgroundImage: `url(${src})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${imgBounds.width * zoomLevel}px ${imgBounds.height * zoomLevel}px`,
              backgroundPosition: `${magnifierPos.x}% ${magnifierPos.y}%`
            }}
          >
            <div className="absolute inset-0 border-[6px] border-black/10 rounded-full" />
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/40 rounded-full text-[8px] font-black text-white uppercase tracking-widest">
                Forensic Zoom
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative HUD */}
      {!showMagnifier && (
         <div className="absolute bottom-6 right-6 p-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white/40 flex items-center gap-2 group-hover:text-blue-400 group-hover:bg-blue-600/20 group-hover:border-blue-500/30 transition-luxury opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
            <ZoomIn size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Inspection Mode</span>
         </div>
      )}
    </div>
  );
}
