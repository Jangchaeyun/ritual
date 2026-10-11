import { pauseAmbient, playAmbient } from "@/lib/ambient-audio";
import type { HabitCategory } from "@/lib/types";

export const STUDY_TODO_ID = "study";
export const WORK_TODO_ID = "work";

export type FocusPurpose = "study" | "work";

export type StudyClock = {
  running: boolean;
  accumulatedMs: number;
  startedAt: number | null;
  originStartedAt: number | null;
  todoId: string | null;
  purpose: FocusPurpose;
};

const STORAGE_KEY = "ritual:study-clock";
const serverClock: StudyClock = {
  running: false,
  accumulatedMs: 0,
  startedAt: null,
  originStartedAt: null,
  todoId: null,
  purpose: "study",
};

let clock: StudyClock = serverClock;
let hydrated = false;
const listeners = new Set<() => void>();

export function emptyStudyClock(): StudyClock {
  return { running: false, accumulatedMs: 0, startedAt: null, originStartedAt: null, todoId: null, purpose: "study" };
}

export function todoMatchesPurpose(category: HabitCategory, purpose: FocusPurpose) {
  return purpose === "work" ? category === "업무" : category !== "업무";
}

export function isFocusPurpose(value: unknown): value is FocusPurpose {
  return value === "study" || value === "work";
}

export function studyElapsedMs(clockState: StudyClock, now: number) {
  const runningMs =
    clockState.running && clockState.startedAt != null ? Math.max(0, now - clockState.startedAt) : 0;
  return clockState.accumulatedMs + runningMs;
}

export function studyMinutes(elapsedMs: number) {
  if (elapsedMs < 1000) return 0;
  return Math.max(1, Math.round(elapsedMs / 60_000));
}

export function formatStudyClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function focusSessionTodoId(purpose: FocusPurpose, todoId: string) {
  return `${purpose}:${todoId}`;
}

export function studySessionTodoId(todoId: string) {
  return focusSessionTodoId("study", todoId);
}

export function sessionPurpose(todoId: string | null): FocusPurpose | null {
  if (!todoId) return null;
  if (todoId === STUDY_TODO_ID || todoId.startsWith(`${STUDY_TODO_ID}:`)) return "study";
  if (todoId === WORK_TODO_ID || todoId.startsWith(`${WORK_TODO_ID}:`)) return "work";
  return null;
}

export function studyTargetId(todoId: string | null) {
  const purpose = sessionPurpose(todoId);
  if (!todoId || !purpose) return null;
  if (todoId === purpose) return null;
  if (todoId.startsWith(`${purpose}:`)) return todoId.slice(purpose.length + 1) || null;
  return null;
}

export function isStudySession(todoId: string | null) {
  return sessionPurpose(todoId) === "study";
}

export function isWorkSession(todoId: string | null) {
  return sessionPurpose(todoId) === "work";
}

export function isTrackedFocus(todoId: string | null) {
  return sessionPurpose(todoId) != null;
}

export function readStudyClock(): StudyClock {
  if (typeof window === "undefined") return emptyStudyClock();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStudyClock();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyStudyClock();
    const record = parsed as Record<string, unknown>;
    const accumulatedMs = typeof record.accumulatedMs === "number" && record.accumulatedMs >= 0 ? record.accumulatedMs : 0;
    const startedAt = typeof record.startedAt === "number" && Number.isFinite(record.startedAt) ? record.startedAt : null;
    const todoId = typeof record.todoId === "string" && record.todoId.trim() ? record.todoId : null;
    const originStartedAt =
      typeof record.originStartedAt === "number" && Number.isFinite(record.originStartedAt)
        ? record.originStartedAt
        : null;
    const running = record.running === true && startedAt != null;
    const resolvedOrigin =
      originStartedAt ??
      (running && startedAt != null
        ? startedAt - accumulatedMs
        : !running && accumulatedMs > 0
          ? Date.now() - accumulatedMs
          : null);
    return {
      running,
      accumulatedMs,
      startedAt: running ? startedAt : null,
      originStartedAt: resolvedOrigin,
      todoId,
      purpose: isFocusPurpose(record.purpose) ? record.purpose : "study",
    };
  } catch {
    return emptyStudyClock();
  }
}

function publish(next: StudyClock) {
  clock = next;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener());
}

export function hydrateStudyClock() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  publish(readStudyClock());
}

export function subscribeStudyClock(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStudySnapshot() {
  return hydrated ? clock : serverClock;
}

export function getStudyServerSnapshot() {
  return serverClock;
}

function liveClock() {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    clock = readStudyClock();
  }
  return hydrated ? clock : serverClock;
}

export function setStudyTodo(todoId: string | null) {
  const current = liveClock();
  if (current.running || current.accumulatedMs > 0) return false;
  publish({ ...current, todoId });
  return true;
}

export function toggleStudyClock() {
  const current = liveClock();
  if (!current.todoId) return false;
  const tick = Date.now();
  if (current.running && current.startedAt != null) {
    publish({
      ...current,
      running: false,
      accumulatedMs: current.accumulatedMs + Math.max(0, tick - current.startedAt),
      startedAt: null,
    });
    pauseAmbient();
    return true;
  }
  publish({
    ...current,
    running: true,
    startedAt: tick,
    originStartedAt: current.originStartedAt ?? tick,
  });
  playAmbient();
  return true;
}

export function setFocusPurpose(purpose: FocusPurpose) {
  const current = liveClock();
  if (current.running || current.accumulatedMs > 0) return false;
  publish({ ...current, purpose });
  return true;
}

export function beginStudyForTodo(todoId: string, purpose: FocusPurpose = "study") {
  const current = liveClock();
  const elapsed = studyElapsedMs(current, Date.now());
  const busy = current.running || elapsed > 0;
  if (busy && current.todoId && current.todoId !== todoId) return false;
  if (busy && current.purpose !== purpose) return false;
  if (current.todoId !== todoId || current.purpose !== purpose) {
    publish({ running: false, accumulatedMs: 0, startedAt: null, originStartedAt: null, todoId, purpose });
  }
  if (!liveClock().running) toggleStudyClock();
  return true;
}

export function clearStudyProgress() {
  const current = liveClock();
  publish({
    running: false,
    accumulatedMs: 0,
    startedAt: null,
    originStartedAt: null,
    todoId: current.todoId,
    purpose: current.purpose,
  });
  pauseAmbient();
}
