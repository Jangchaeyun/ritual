"use client";

import { Header } from "@/components/layout/header";
import { SidebarContent } from "@/components/layout/sidebar";
import { useRoutine } from "@/components/routine-provider";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, toggleSidebar, ready } = useRoutine();
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();
  const collapsed = ready ? sidebarCollapsed : false;

  return (
    <div className="relative min-h-screen text-[#1c2430]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-[#1c2430] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문으로 건너뛰기
      </a>

      <div className="relative flex min-h-screen">
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 88 : 248 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}
          className="sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-black/[0.06] bg-[#f3f0ea] md:block"
        >
          <SidebarContent collapsed={collapsed} onToggle={toggleSidebar} />
        </motion.aside>

        <AnimatePresence>
          {mobileOpen ? (
            <>
              <motion.button
                type="button"
                aria-label="메뉴 닫기"
                className="fixed inset-0 z-40 bg-[#1c2430]/25 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                className="fixed inset-y-0 left-0 z-50 w-[min(100%,280px)] border-r border-black/[0.06] bg-[#f3f0ea] shadow-xl md:hidden"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}
              >
                <SidebarContent collapsed={false} onClose={() => setMobileOpen(false)} />
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenu={() => setMobileOpen(true)} />
          <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
