"use client";

import { motion } from "motion/react";

// Переход между разделами: плавное появление с небольшим сдвигом вверх (≈200 мс, не мешает работе)
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
