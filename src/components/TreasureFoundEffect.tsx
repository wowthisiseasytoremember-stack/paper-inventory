"use client";
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function TreasureFoundEffect({ trigger }: { trigger: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 600);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-white/20 pointer-events-none z-50"
        />
      )}
    </AnimatePresence>
  );
}
