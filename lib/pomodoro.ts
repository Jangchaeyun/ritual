import type { PomodoroPhase, PomodoroState } from "@/lib/types";

export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;

export function clampFocusMinutes(value: unknown) {
  const minutes = typeof value === "number" ? Math.round(value) : DEFAULT_FOCUS_MINUTES;
  if (!Number.isFinite(minutes)) return DEFAULT_FOCUS_MINUTES;
  return Math.min(180, Math.max(1, minutes));
}

export function clampBreakMinutes(value: unknown) {
  const minutes = typeof value === "number" ? Math.round(value) : DEFAULT_BREAK_MINUTES;
  if (!Number.isFinite(minutes)) return DEFAULT_BREAK_MINUTES;
  return Math.min(60, Math.max(1, minutes));
}

export function durationForPhase(
  phase: PomodoroPhase,
  lengths?: { focusMinutes?: number; breakMinutes?: number },
) {
  const focus = clampFocusMinutes(lengths?.focusMinutes) * 60;
  const rest = clampBreakMinutes(lengths?.breakMinutes) * 60;
  return phase === "focus" ? focus : rest;
}

export function remainingSeconds(state: PomodoroState, now: number | null) {
  if (state.running && state.endsAt != null && now != null) {
    return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  }
  return Math.max(0, state.remainingSec);
}

export function earnedPhaseMinutes(state: PomodoroState, now: number) {
  const remaining = remainingSeconds(state, now);
  const elapsed = Math.max(0, state.durationSec - remaining);
  if (elapsed <= 0) return 0;
  const planned = Math.max(1, Math.round(state.durationSec / 60));
  return Math.min(planned, Math.max(1, Math.round(elapsed / 60)));
}

export function completePomodoroPhase(state: PomodoroState): PomodoroState {
  const finishedFocus = state.phase === "focus";
  const phase: PomodoroPhase = finishedFocus ? "break" : "focus";
  const durationSec = durationForPhase(phase, state);
  return {
    phase,
    durationSec,
    remainingSec: durationSec,
    running: false,
    endsAt: null,
    completedFocus: state.completedFocus + (finishedFocus ? 1 : 0),
    targetFocus: state.targetFocus,
    focusMinutes: clampFocusMinutes(state.focusMinutes),
    breakMinutes: clampBreakMinutes(state.breakMinutes),
    linkedTodoId: state.linkedTodoId ?? null,
    sessions: state.sessions ?? [],
  };
}

export function revivePomodoro(state: PomodoroState): PomodoroState {
  const linkedTodoId = typeof state.linkedTodoId === "string" ? state.linkedTodoId : null;
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const focusMinutes = clampFocusMinutes(state.focusMinutes);
  const breakMinutes = clampBreakMinutes(state.breakMinutes);
  const normalized: PomodoroState = {
    ...state,
    linkedTodoId,
    sessions,
    focusMinutes,
    breakMinutes,
  };
  rememberTimerLengths(focusMinutes, breakMinutes);
  return hydratePomodoro(normalized);
}

const rememberedLengths = { focusMinutes: DEFAULT_FOCUS_MINUTES, breakMinutes: DEFAULT_BREAK_MINUTES };
const lengthListeners = new Set<() => void>();

export function rememberTimerLengths(focusMinutes: number, breakMinutes: number) {
  const focus = clampFocusMinutes(focusMinutes);
  const rest = clampBreakMinutes(breakMinutes);
  if (rememberedLengths.focusMinutes === focus && rememberedLengths.breakMinutes === rest) return;
  rememberedLengths.focusMinutes = focus;
  rememberedLengths.breakMinutes = rest;
  lengthListeners.forEach((listener) => listener());
}

export function rememberedTimerLengths() {
  return { ...rememberedLengths };
}

export function subscribeTimerLengths(listener: () => void) {
  lengthListeners.add(listener);
  return () => lengthListeners.delete(listener);
}

export function hydratePomodoro(state: PomodoroState): PomodoroState {
  if (!state.running || state.endsAt == null) return state;
  const remaining = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
  if (remaining === state.remainingSec) return state;
  return { ...state, remainingSec: remaining };
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
