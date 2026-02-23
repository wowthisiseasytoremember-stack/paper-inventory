"use client";

import React from 'react';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { DebugFAB } from './DebugFAB';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-[var(--bg-900)] overflow-hidden font-sans text-[var(--text-100)]">
      {/* Centered App Canvas */}
      <div className="flex h-full w-full max-w-[1440px] mx-auto relative shadow-2xl border-x border-[var(--surface-800)]/30">
        
        {/* Fixed Left Sidebar (260px) */}
        <Sidebar className="w-[260px] shrink-0 border-r border-[var(--surface-800)]" />
        
        {/* Main Content Area */}
        <div className="flex-grow overflow-y-auto relative custom-scrollbar bg-[var(--bg-900)] pl-[32px]">
          <div className="w-[988px] h-full mx-auto xs:mx-0">
            {children}
          </div>
        </div>
        
      </div>
      
      <Toaster position="bottom-right" theme="dark" closeButton />
      <DebugFAB />
    </div>
  );
}
