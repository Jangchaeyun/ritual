import { AMBIENT_TRACKS, type AmbientTrackId } from "@/lib/ambient-audio";
import {
  isHabitList,
  isHistoryState,
  isPomodoroState,
  isProfile,
  isTodoList,
  isUiState,
  reviveHabits,
  reviveHistory,
  reviveTodos,
  type Habit,
  type HistoryState,
  isReflectionLog,
  reviveReflections,
  type ReflectionLog,
  type PomodoroState,
  type Profile,
  type Todo,
  type UiState,
} from "@/lib/types";
import { revivePomodoro } from "@/lib/pomodoro";

export const BACKUP_VERSION = 1;

export type AmbientBackup = {
  track: AmbientTrackId;
  volume: number;
};

export type RitualBackup = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  profile: Profile;
  habits: Habit[];
  todos: Todo[];
  pomodoro: PomodoroState;
  ui: UiState;
  history: HistoryState;
  ambient: AmbientBackup | null;
  focusAlert: boolean | null;
  reflections: ReflectionLog | null;
};

export type BackupParseResult = { ok: true; backup: RitualBackup } | { ok: false; message: string };

function isAmbientBackup(value: unknown): value is AmbientBackup {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    AMBIENT_TRACKS.some((track) => track.id === record.track) &&
    typeof record.volume === "number" &&
    Number.isFinite(record.volume)
  );
}

export function parseRitualBackup(value: unknown): BackupParseResult {
  if (!value || typeof value !== "object") {
    return { ok: false, message: "JSON 객체 형식의 백업 파일이 아닙니다." };
  }
  const record = value as Record<string, unknown>;
  if (record.version !== BACKUP_VERSION) {
    return { ok: false, message: "지원하지 않는 백업 버전입니다." };
  }
  if (!isProfile(record.profile)) return { ok: false, message: "프로필 데이터 형식이 올바르지 않습니다." };
  if (!isHabitList(record.habits)) return { ok: false, message: "습관 데이터 형식이 올바르지 않습니다." };
  if (!isTodoList(record.todos)) return { ok: false, message: "할 일 데이터 형식이 올바르지 않습니다." };
  if (!isPomodoroState(record.pomodoro)) return { ok: false, message: "포모도로 데이터 형식이 올바르지 않습니다." };
  if (!isUiState(record.ui)) return { ok: false, message: "화면 설정 형식이 올바르지 않습니다." };
  if (!isHistoryState(record.history)) return { ok: false, message: "기록 데이터 형식이 올바르지 않습니다." };
  if (record.ambient != null && !isAmbientBackup(record.ambient)) {
    return { ok: false, message: "배경 소리 설정 형식이 올바르지 않습니다." };
  }
  if (record.focusAlert != null && typeof record.focusAlert !== "boolean") {
    return { ok: false, message: "알림 설정 형식이 올바르지 않습니다." };
  }
  if (record.reflections != null && !isReflectionLog(record.reflections)) {
    return { ok: false, message: "회고 데이터 형식이 올바르지 않습니다." };
  }

  const ambient = isAmbientBackup(record.ambient)
    ? { track: record.ambient.track, volume: Math.min(1, Math.max(0, record.ambient.volume)) }
    : null;

  return {
    ok: true,
    backup: {
      version: BACKUP_VERSION,
      exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
      profile: record.profile,
      habits: reviveHabits(record.habits),
      todos: reviveTodos(record.todos),
      pomodoro: revivePomodoro(record.pomodoro),
      ui: record.ui,
      history: reviveHistory(record.history),
      ambient,
      focusAlert: typeof record.focusAlert === "boolean" ? record.focusAlert : null,
      reflections: isReflectionLog(record.reflections) ? reviveReflections(record.reflections) : null,
    },
  };
}

export function downloadRitualBackup(backup: RitualBackup, filename: string) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
