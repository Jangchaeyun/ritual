"use client";

import { applyHabitToggle } from "@/lib/habit-toggle";
import { seoulDateKey } from "@/lib/analytics";
import { useAccount } from "@/components/account-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ensureRemoteProfile, getOrCreateProfileId } from "@/lib/supabase-profile";
import {
  clampHabitTarget,
  isHabitCategory,
  type Habit,
  type HabitCategory,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

type HabitRow = {
  id: string;
  title: string;
  category: string;
  target_count: number;
};

function isHabitRow(value: unknown): value is HabitRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.title === "string" && typeof row.category === "string" && typeof row.target_count === "number";
}

export function useHabits() {
  const account = useAccount();
  const enabled = Boolean(account.user);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const habitsRef = useRef(habits);
  const tokens = useRef<Record<string, number>>({});

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoaded(true);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const profileId = getOrCreateProfileId();
    if (!supabase || !profileId) {
      setError("Supabase 설정을 읽지 못했습니다.");
      setLoaded(true);
      return;
    }
    const today = seoulDateKey(Date.now());
    const profileStreak = await ensureRemoteProfile(profileId, account.user?.name ?? "");
    const [{ data: habitRows, error: habitError }, { data: logRows, error: logError }] = await Promise.all([
      supabase.from("habits").select("id, title, category, target_count").eq("user_id", profileId).order("created_at"),
      supabase.from("habit_logs").select("habit_id").eq("user_id", profileId).eq("log_date", today),
    ]);
    if (habitError || logError) {
      setError(habitError?.message ?? logError?.message ?? "습관을 불러오지 못했습니다.");
      setLoaded(true);
      return;
    }
    const counts = new Map<string, number>();
    for (const row of logRows ?? []) {
      if (!row || typeof row !== "object" || !("habit_id" in row) || typeof row.habit_id !== "string") continue;
      counts.set(row.habit_id, (counts.get(row.habit_id) ?? 0) + 1);
    }
    const next = (habitRows ?? []).flatMap((row) => {
      if (!isHabitRow(row) || !isHabitCategory(row.category)) return [];
      const targetCount = clampHabitTarget(row.target_count);
      return [
        {
          id: row.id,
          title: row.title,
          category: row.category,
          targetCount,
          completedCount: Math.min(targetCount, counts.get(row.id) ?? 0),
        },
      ];
    });
    habitsRef.current = next;
    setHabits(next);
    setStreak(profileStreak ?? 0);
    setError(null);
    setLoaded(true);
  }, [account.user?.name, enabled]);

  useEffect(() => {
    const tick = () => {
      const key = seoulDateKey(Date.now());
      setDay((prev) => (prev === key ? prev : key));
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!enabled) {
      habitsRef.current = [];
      setHabits([]);
      setStreak(0);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    void reload().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "습관을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [day, enabled, reload]);

  const toggle = useCallback((id: string) => {
    const profileId = getOrCreateProfileId();
    const snapshot = habitsRef.current;
    const applied = applyHabitToggle(snapshot, id);
    if (!applied || !profileId) return null;
    const token = (tokens.current[id] ?? 0) + 1;
    tokens.current[id] = token;
    habitsRef.current = applied.habits;
    setHabits(applied.habits);
    setError(null);
    const done = fetch("/api/habits/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: id }),
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || !payload || typeof payload !== "object") throw new Error("check_failed");
        const body = payload as Record<string, unknown>;
        if (typeof body.streak !== "number" || typeof body.completedCount !== "number") throw new Error("check_failed");
        if (tokens.current[id] !== token) return { streak: body.streak };
        setHabits((current) => {
          const next = current.map((habit) =>
            habit.id === id ? { ...habit, completedCount: body.completedCount as number } : habit,
          );
          habitsRef.current = next;
          return next;
        });
        setStreak(body.streak);
        return { streak: body.streak };
      })
      .catch((reason: unknown) => {
        if (tokens.current[id] === token) {
          habitsRef.current = snapshot;
          setHabits(snapshot);
          setError("저장하지 못해 체크를 되돌렸습니다.");
        }
        throw reason;
      });
    return { streakDelta: applied.streakDelta, done };
  }, []);

  const add = useCallback(async (input: { id?: string; title: string; category: HabitCategory; targetCount: number }) => {
    const supabase = createSupabaseBrowserClient();
    const profileId = getOrCreateProfileId();
    if (!supabase || !profileId) return;
    const habit: Habit = {
      id: input.id ?? crypto.randomUUID(),
      title: input.title,
      category: input.category,
      targetCount: input.targetCount,
      completedCount: 0,
    };
    const snapshot = habitsRef.current;
    const next = [...snapshot, habit];
    habitsRef.current = next;
    setHabits(next);
    const { error: insertError } = await supabase.from("habits").insert({
      id: habit.id,
      user_id: profileId,
      title: habit.title,
      category: habit.category,
      target_count: habit.targetCount,
    });
    if (insertError) {
      habitsRef.current = snapshot;
      setHabits(snapshot);
      setError("습관을 저장하지 못했습니다.");
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const profileId = getOrCreateProfileId();
    if (!supabase || !profileId) return;
    const snapshot = habitsRef.current;
    const next = snapshot.filter((habit) => habit.id !== id);
    habitsRef.current = next;
    setHabits(next);
    const { error: deleteError } = await supabase.from("habits").delete().eq("id", id).eq("user_id", profileId);
    if (deleteError) {
      habitsRef.current = snapshot;
      setHabits(snapshot);
      setError("습관을 지우지 못했습니다.");
    }
  }, []);

  return { enabled, loaded, habits, streak, error, toggle, add, remove };
}
