"use client";

import { useAccount } from "@/components/account-provider";
import { useRoutine } from "@/components/routine-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogOut, Menu } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

function seoulHour(date: Date) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? "0");
}

function greetingForHour(hour: number) {
  if (hour < 5) return "조용한 밤이에요";
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

const serverClock = { label: "", compact: "", greeting: "" };
let clientClock: { label: string; compact: string; greeting: string } | null = null;

function subscribeClock() {
  return () => {};
}

function getClockSnapshot() {
  const now = new Date();
  const label = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  const compact = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(now);
  const greeting = greetingForHour(seoulHour(now));
  if (clientClock && clientClock.label === label && clientClock.compact === compact && clientClock.greeting === greeting) return clientClock;
  clientClock = { label, compact, greeting };
  return clientClock;
}

function getClockServerSnapshot() {
  return serverClock;
}

export function Header({ onMenu }: { onMenu: () => void }) {
  const { profile, ready } = useRoutine();
  const account = useAccount();
  const clock = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockServerSnapshot);
  const todayLabel = clock.label;
  const greeting = clock.greeting;
  const [trackedStreak, setTrackedStreak] = useState<number | null>(null);
  const [streakPulse, setStreakPulse] = useState(0);

  if (ready && trackedStreak !== profile.streak) {
    const previous = trackedStreak;
    setTrackedStreak(profile.streak);
    if (previous != null && profile.streak > previous) {
      setStreakPulse((value) => value + 1);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-xl">
      <div className="flex h-[4.25rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card text-soft transition hover:text-ink md:hidden"
            aria-label="메뉴 열기"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[11px] tracking-[0.16em] text-muted">{greeting || "오늘"}</p>
            <p className="truncate text-sm font-medium tracking-[-0.01em] text-ink sm:hidden">{clock.compact || "오늘"}</p>
            <p className="hidden truncate text-sm font-medium tracking-[-0.01em] text-ink sm:block">{todayLabel || "오늘"}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {ready ? (
            <span className="relative inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-ink sm:px-3">
              <motion.span
                key={streakPulse}
                aria-hidden
                initial={streakPulse === 0 ? false : { scale: 1, rotate: -8 }}
                animate={streakPulse === 0 ? undefined : { scale: [1, 1.45, 1], rotate: [0, -14, 0] }}
                transition={{ duration: 0.45 }}
              >
                🔥
              </motion.span>
              <span className="sm:hidden">
                연속{" "}
                <motion.span
                  key={`m-${streakPulse}`}
                  className="inline-block tabular-nums"
                  initial={streakPulse === 0 ? false : { scale: 1.5, y: -2 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 16 }}
                >
                  {profile.streak}
                </motion.span>
                일
              </span>
              <span className="hidden sm:inline">
                연속{" "}
                <motion.span
                  key={`d-${streakPulse}`}
                  className="inline-block tabular-nums"
                  initial={streakPulse === 0 ? false : { scale: 1.5, y: -2 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 16 }}
                >
                  {profile.streak}
                </motion.span>
                일 달성
              </span>
              <AnimatePresence>
                {streakPulse > 0 ? (
                  <motion.span
                    key={streakPulse}
                    className="pointer-events-none absolute -top-3 right-2 text-[11px] font-semibold text-clay"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: [0, 1, 0], y: -14 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                  >
                    +1
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </span>
          ) : (
            <span className="h-8 w-24 animate-pulse rounded-full bg-wash" />
          )}

          {ready ? (
            <div className="flex items-center gap-2.5">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-ink">{profile.name}</p>
                <p className="text-[11px] text-muted">{profile.role}</p>
              </div>
              <div
                className="grid size-9 place-items-center rounded-full bg-fill text-[11px] font-medium tracking-tight text-on-fill"
                aria-hidden
              >
                {profile.initials}
              </div>
              <span className="sr-only">{profile.name} 프로필</span>
              {account.user ? (
                <button
                  type="button"
                  onClick={() => {
                    void createSupabaseBrowserClient()?.auth.signOut();
                  }}
                  className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-card hover:text-ink"
                  aria-label="로그아웃"
                >
                  <LogOut className="size-4" />
                </button>
              ) : null}
            </div>
          ) : (
            <span className="size-10 animate-pulse rounded-full bg-wash" />
          )}
        </div>
      </div>
    </header>
  );
}
