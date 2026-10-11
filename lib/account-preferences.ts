import { AMBIENT_TRACKS, applyAmbientSettings, exportAmbientSettings, type AmbientTrackId } from "@/lib/ambient-audio";
import { applyFocusAlertEnabled, exportFocusAlertEnabled } from "@/lib/focus-alert";
import { clampBreakMinutes, clampFocusMinutes, rememberedTimerLengths } from "@/lib/pomodoro";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { exportTimerColors, replaceTimerColors } from "@/lib/timer-colors";

export type AccountPreferences = {
  sidebarCollapsed: boolean;
  ambient: { track: AmbientTrackId; volume: number };
  focusAlert: boolean;
  focusMinutes: number;
  breakMinutes: number;
  timerColors: Record<string, string>;
};

function isTrack(value: unknown): value is AmbientTrackId {
  return AMBIENT_TRACKS.some((track) => track.id === value);
}

export const PREFERENCE_JOURNAL_DATE = "1900-01-01";

function missingPreferencesColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /preferences/i.test(error.message ?? "");
}

export function readAccountPreferences(value: unknown): Partial<AccountPreferences> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const next: Partial<AccountPreferences> = {};
  if (typeof record.sidebarCollapsed === "boolean") next.sidebarCollapsed = record.sidebarCollapsed;
  if (typeof record.focusAlert === "boolean") next.focusAlert = record.focusAlert;
  if (typeof record.focusMinutes === "number") next.focusMinutes = clampFocusMinutes(record.focusMinutes);
  if (typeof record.breakMinutes === "number") next.breakMinutes = clampBreakMinutes(record.breakMinutes);
  if (record.ambient && typeof record.ambient === "object") {
    const ambient = record.ambient as Record<string, unknown>;
    if (isTrack(ambient.track) && typeof ambient.volume === "number" && Number.isFinite(ambient.volume)) {
      next.ambient = { track: ambient.track, volume: Math.min(1, Math.max(0, ambient.volume)) };
    }
  }
  if (record.timerColors && typeof record.timerColors === "object" && !Array.isArray(record.timerColors)) {
    const colors: Record<string, string> = {};
    for (const [key, color] of Object.entries(record.timerColors)) {
      if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) colors[key] = color.toLowerCase();
    }
    next.timerColors = colors;
  }
  return next;
}

export function currentAccountPreferences(sidebarCollapsed: boolean): AccountPreferences {
  const lengths = rememberedTimerLengths();
  return {
    sidebarCollapsed,
    ambient: exportAmbientSettings(),
    focusAlert: exportFocusAlertEnabled(),
    focusMinutes: lengths.focusMinutes,
    breakMinutes: lengths.breakMinutes,
    timerColors: exportTimerColors(),
  };
}

export function applyAccountPreferences(prefs: Partial<AccountPreferences>) {
  if (prefs.ambient) applyAmbientSettings(prefs.ambient);
  if (typeof prefs.focusAlert === "boolean") applyFocusAlertEnabled(prefs.focusAlert);
  if (prefs.timerColors) replaceTimerColors(prefs.timerColors);
}

export async function loadAccountPreferences(userId: string) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle();
  if (!error && data && typeof data === "object" && "preferences" in data && data.preferences) {
    const parsed = readAccountPreferences(data.preferences);
    if (parsed && Object.keys(parsed).length > 0) return parsed;
  }
  if (error && !missingPreferencesColumn(error)) return null;
  const { data: journal, error: journalError } = await supabase
    .from("daily_journals")
    .select("body")
    .eq("user_id", userId)
    .eq("journal_date", PREFERENCE_JOURNAL_DATE)
    .maybeSingle();
  if (journalError || !journal || typeof journal.body !== "string") return null;
  try {
    return readAccountPreferences(JSON.parse(journal.body));
  } catch {
    return null;
  }
}

export async function saveAccountPreferences(userId: string, prefs: AccountPreferences) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.from("profiles").update({ preferences: prefs }).eq("id", userId);
  if (!error) return true;
  if (!missingPreferencesColumn(error)) return false;
  const { error: journalError } = await supabase.from("daily_journals").upsert(
    {
      user_id: userId,
      journal_date: PREFERENCE_JOURNAL_DATE,
      body: JSON.stringify(prefs),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,journal_date" },
  );
  return !journalError;
}
