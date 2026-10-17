"use client";

import { cn } from "@/lib/cn";
import { applyTheme, exportTheme, isThemeId, subscribeTheme, type ThemeId } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  return subscribeTheme(listener);
}

function getSnapshot(): ThemeId {
  return exportTheme();
}

function getServerSnapshot(): ThemeId {
  return "light";
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ThemeBoot() {
  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem("ritual:theme");
      if (isThemeId(stored)) applyTheme(stored);
    } catch {
      /* private mode */
    }
  }, []);
  return null;
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={dark ? "밝은 테마로 전환" : "어두운 테마로 전환"}
      onClick={() => applyTheme(dark ? "light" : "dark")}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-2.5 text-xs font-medium text-ink transition hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="sr-only">{dark ? "밝은 테마" : "어두운 테마"}</span>
    </button>
  );
}

export function ThemeChoice() {
  const theme = useTheme();

  return (
    <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="화면 테마">
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => applyTheme("light")}
        className={cn(
          "h-11 rounded-xl border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
          theme === "light" ? "border-transparent bg-fill text-on-fill" : "border-line bg-field text-soft hover:text-ink",
        )}
      >
        밝은 테마
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => applyTheme("dark")}
        className={cn(
          "h-11 rounded-xl border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
          theme === "dark" ? "border-transparent bg-fill text-on-fill" : "border-line bg-field text-soft hover:text-ink",
        )}
      >
        어두운 테마
      </button>
    </div>
  );
}
