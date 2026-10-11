export const TIMER_PALETTE = ["#f2a3c2", "#f0b27a", "#e6d36a", "#8fb096", "#7ec8c3", "#6f93b8", "#8b7ec8", "#c4899a"] as const;

const STORAGE_KEY = "ritual:timer-colors";
const HEX = /^#[0-9a-fA-F]{6}$/;

let colors: Record<string, string> = {};
let hydrated = false;
const listeners = new Set<() => void>();
const emptyColors: Record<string, string> = {};

function sanitize(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, string> = {};
  for (const [key, color] of Object.entries(value)) {
    if (typeof key === "string" && key.trim() && typeof color === "string" && HEX.test(color)) {
      next[key] = color.toLowerCase();
    }
  }
  return next;
}

function publish(next: Record<string, string>) {
  colors = next;
  hydrated = true;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener());
}

export function readStoredTimerColors() {
  if (typeof window === "undefined") return {};
  try {
    return sanitize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? ""));
  } catch {
    return {};
  }
}

export function hydrateTimerColors() {
  if (hydrated || typeof window === "undefined") return;
  publish(readStoredTimerColors());
}

export function subscribeTimerColors(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTimerColorSnapshot() {
  return hydrated ? colors : emptyColors;
}

export function getTimerColorServerSnapshot() {
  return emptyColors;
}

export function exportTimerColors() {
  return { ...colors };
}

export function replaceTimerColors(value: unknown) {
  publish(sanitize(value));
}

export function setTimerColor(todoId: string, color: string) {
  if (!HEX.test(color)) return;
  const current = hydrated ? colors : readStoredTimerColors();
  publish({ ...current, [todoId]: color.toLowerCase() });
}

export function colorForTodo(todoId: string | null, chosen: Record<string, string>) {
  if (todoId && chosen[todoId] && HEX.test(chosen[todoId])) return chosen[todoId];
  let hash = 0;
  const seed = todoId ?? "timer";
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TIMER_PALETTE[hash % TIMER_PALETTE.length];
}
