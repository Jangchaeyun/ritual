"use client";

import { cn } from "@/lib/cn";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export const panelClass =
  "group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_1px_rgba(28,36,48,0.04),0_16px_40px_-28px_rgba(28,36,48,0.28)]";

export function Surface({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.28, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(panelClass, className)}
    >
      {children}
    </motion.section>
  );
}
