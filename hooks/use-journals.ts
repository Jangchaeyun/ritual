"use client";

import { useAccount } from "@/components/account-provider";
import { PREFERENCE_JOURNAL_DATE } from "@/lib/account-preferences";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getOrCreateProfileId } from "@/lib/supabase-profile";
import { MAX_REFLECTION_LENGTH, type ReflectionLog } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function useJournals() {
  const account = useAccount();
  const enabled = Boolean(account.user);
  const [notes, setNotes] = useState<ReflectionLog>({});
  const [loaded, setLoaded] = useState(!enabled);
  const [error, setError] = useState<string | null>(null);
  const notesRef = useRef(notes);
  const timers = useRef<Record<string, number>>({});

  const reload = useCallback(async () => {
    if (!enabled) {
      notesRef.current = {};
      setNotes({});
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
    const { data, error: readError } = await supabase
      .from("daily_journals")
      .select("journal_date, body")
      .eq("user_id", profileId);
    if (readError) {
      setError("회고를 불러오지 못했습니다.");
      setLoaded(true);
      return;
    }
    const next: ReflectionLog = {};
    for (const row of data ?? []) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      if (typeof record.journal_date !== "string" || !DATE_KEY.test(record.journal_date)) continue;
      if (record.journal_date === PREFERENCE_JOURNAL_DATE) continue;
      if (typeof record.body !== "string") continue;
      const body = record.body.trim().slice(0, MAX_REFLECTION_LENGTH);
      if (body) next[record.journal_date] = body;
    }
    notesRef.current = next;
    setNotes(next);
    setError(null);
    setLoaded(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      notesRef.current = {};
      setNotes({});
      setLoaded(true);
      return;
    }
    setLoaded(false);
    void reload().catch(() => {
      setError("회고를 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [enabled, reload]);

  const persist = useCallback(async (date: string, text: string) => {
    const supabase = createSupabaseBrowserClient();
    const profileId = getOrCreateProfileId();
    if (!supabase || !profileId || !DATE_KEY.test(date)) return;
    const body = text.trim().slice(0, MAX_REFLECTION_LENGTH);
    const write = body
      ? supabase.from("daily_journals").upsert(
          { user_id: profileId, journal_date: date, body, updated_at: new Date().toISOString() },
          { onConflict: "user_id,journal_date" },
        )
      : supabase.from("daily_journals").delete().eq("user_id", profileId).eq("journal_date", date);
    const { error: writeError } = await write;
    if (writeError) setError("회고를 저장하지 못했습니다.");
    else setError(null);
  }, []);

  const save = useCallback(
    (date: string, text: string) => {
      const nextText = text.slice(0, MAX_REFLECTION_LENGTH);
      setNotes((prev) => {
        const next = { ...prev };
        const trimmed = nextText.trim();
        if (!trimmed) delete next[date];
        else next[date] = nextText;
        notesRef.current = next;
        return next;
      });
      window.clearTimeout(timers.current[date]);
      timers.current[date] = window.setTimeout(() => {
        void persist(date, nextText);
      }, 400);
    },
    [persist],
  );

  const replace = useCallback(
    (next: ReflectionLog) => {
      const previous = notesRef.current;
      notesRef.current = next;
      setNotes(next);
      const dates = new Set([...Object.keys(previous), ...Object.keys(next)]);
      for (const date of dates) {
        if (previous[date] === next[date]) continue;
        window.clearTimeout(timers.current[date]);
        void persist(date, next[date] ?? "");
      }
    },
    [persist],
  );

  return { enabled, loaded, notes, error, save, replace };
}
