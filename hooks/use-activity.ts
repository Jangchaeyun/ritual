"use client";

import { useAccount } from "@/components/account-provider";
import { addDays, seoulDateKey } from "@/lib/analytics";
import type { HabitLogPoint } from "@/lib/remote-history";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { isMissingColumn } from "@/lib/supabase-error";
import { getOrCreateProfileId } from "@/lib/supabase-profile";
import type { PomodoroSession } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

async function loadSessions(
  supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
  profileId: string,
  withStart: boolean,
) {
  const columns = withStart
    ? "id, phase, minutes, todo_id, completed_at, started_at"
    : "id, phase, minutes, todo_id, completed_at";
  const pageSize = 1000;
  const rows: unknown[] = [];
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await supabase
      .from("pomodoro_sessions")
      .select(columns)
      .eq("user_id", profileId)
      .order("completed_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { rows, error: null };
  }
  return { rows, error: null };
}

function toSession(value: unknown): PomodoroSession | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const completedAt = typeof row.completed_at === "string" ? Date.parse(row.completed_at) : Number.NaN;
  const startedRaw = typeof row.started_at === "string" ? Date.parse(row.started_at) : Number.NaN;
  if (
    typeof row.id !== "string" ||
    (row.phase !== "focus" && row.phase !== "break") ||
    typeof row.minutes !== "number" ||
    (row.todo_id !== null && typeof row.todo_id !== "string") ||
    !Number.isFinite(completedAt)
  ) {
    return null;
  }
  return {
    id: row.id,
    phase: row.phase,
    minutes: row.minutes,
    todoId: typeof row.todo_id === "string" ? row.todo_id : null,
    startedAt: Number.isFinite(startedRaw) ? startedRaw : null,
    completedAt,
  };
}

export function useActivity() {
  const account = useAccount();
  const enabled = Boolean(account.user);
  const [logs, setLogs] = useState<HabitLogPoint[]>([]);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [loaded, setLoaded] = useState(!enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLogs([]);
      setSessions([]);
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
    const since = addDays(seoulDateKey(Date.now()), -120);
    const sessionResult = await loadSessions(supabase, profileId, true);
    const { data: logRows, error: logError } = await supabase
      .from("habit_logs")
      .select("habit_id, log_date")
      .eq("user_id", profileId)
      .gte("log_date", since);
    let sessionRows: unknown[] | null = sessionResult.rows;
    let sessionError: { message?: string; code?: string } | null = sessionResult.error;
    if (sessionError && isMissingColumn(sessionError, "started_at")) {
      const retry = await loadSessions(supabase, profileId, false);
      sessionRows = retry.rows;
      sessionError = retry.error;
    }
    if (logError || sessionError) {
      setError("달성 기록을 불러오지 못했습니다.");
      setLoaded(true);
      return;
    }
    const nextLogs: HabitLogPoint[] = [];
    for (const row of logRows ?? []) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      if (typeof record.habit_id === "string" && typeof record.log_date === "string") {
        nextLogs.push({ habitId: record.habit_id, date: record.log_date });
      }
    }
    setLogs(nextLogs);
    setSessions((sessionRows ?? []).flatMap((row) => {
      const session = toSession(row);
      return session ? [session] : [];
    }));
    setError(null);
    setLoaded(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLogs([]);
      setSessions([]);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    void reload().catch(() => {
      setError("달성 기록을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [enabled, reload]);

  const replaceSession = useCallback((session: PomodoroSession) => {
    setSessions((list) => list.map((item) => (item.id === session.id ? session : item)));
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions((list) => list.filter((item) => item.id !== id));
  }, []);

  return { enabled, loaded, logs, sessions, error, reload, replaceSession, removeSession };
}
