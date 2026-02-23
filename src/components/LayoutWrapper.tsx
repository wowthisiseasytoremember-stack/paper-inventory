"use client";

import React from 'react';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { DebugFAB } from './DebugFAB';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-grow overflow-y-auto relative custom-scrollbar">
        {children}
      </div>
      <Toaster position="bottom-right" theme="dark" closeButton />
      <DebugFAB />
    </div>
  );
}
