"use client";

import React from 'react';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { DebugFAB } from './DebugFAB';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden font-sans text-slate-200">
      {/* App Container */}
      <div className="flex h-full w-full relative">
        
        {/* Sidebar - Fixed */}
        <Sidebar className="w-64 shrink-0 border-r border-white/5 shadow-2xl z-20" />
        
        {/* Main Content Area - Scrollable */}
        <main className="flex-grow overflow-y-auto relative custom-scrollbar bg-slate-950">
          <div className="max-w-[1600px] mx-auto min-h-full">
            {children}
          </div>
        </main>
        
      </div>
      
      <Toaster position="bottom-right" theme="dark" closeButton />
      <DebugFAB />
    </div>
  );
}
