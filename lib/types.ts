export const HABIT_CATEGORIES = ["건강", "학습", "업무", "마음"] as const;

export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

export const MIN_HABIT_TARGET = 1;
export const MAX_HABIT_TARGET = 7;

export type Habit = {
  id: string;
  title: string;
  category: HabitCategory;
  targetCount: number;
  completedCount: number;
};

export function clampHabitTarget(value: number) {
  if (!Number.isFinite(value)) return MIN_HABIT_TARGET;
  return Math.min(MAX_HABIT_TARGET, Math.max(MIN_HABIT_TARGET, Math.round(value)));
}

export function isHabitDone(habit: Habit) {
  return habit.targetCount > 0 && habit.completedCount >= habit.targetCount;
}

export const TODO_PRIORITIES = ["high", "medium", "low"] as const;
export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export const TODO_STATUSES = ["todo", "doing", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export type Todo = {
  id: string;
  title: string;
  priority: TodoPriority;
  status: TodoStatus;
  focusMinutes: number;
  category: HabitCategory;
};

export type DailyRecord = {
  date: string;
  habitDone: number;
  habitTotal: number;
  focusSessions: number;
  categories: Record<HabitCategory, number>;
};

export type HistoryState = {
  days: DailyRecord[];
  importedSessionIds: string[];
};

export type ReflectionLog = Record<string, string>;

const REFLECTION_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_REFLECTION_LENGTH = 80;

export function isReflectionLog(value: unknown): value is ReflectionLog {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([date, note]) => REFLECTION_DATE.test(date) && typeof note === "string" && note.length <= MAX_REFLECTION_LENGTH,
  );
}

export function reviveReflections(log: ReflectionLog): ReflectionLog {
  let changed = false;
  const next: ReflectionLog = {};
  for (const [date, note] of Object.entries(log)) {
    const text = note.trim().slice(0, MAX_REFLECTION_LENGTH);
    if (!text) {
      changed = true;
      continue;
    }
    if (text !== note) changed = true;
    next[date] = text;
  }
  return changed ? next : log;
}

export type PomodoroPhase = "focus" | "break";

export type PomodoroSession = {
  id: string;
  phase: PomodoroPhase;
  minutes: number;
  todoId: string | null;
  startedAt?: number | null;
  completedAt: number;
};

export type PomodoroState = {
  phase: PomodoroPhase;
  durationSec: number;
  remainingSec: number;
  running: boolean;
  endsAt: number | null;
  completedFocus: number;
  targetFocus: number;
  focusMinutes?: number;
  breakMinutes?: number;
  linkedTodoId: string | null;
  sessions: PomodoroSession[];
};

export type Profile = {
  name: string;
  role: string;
  initials: string;
  streak: number;
};

export type UiState = {
  sidebarCollapsed: boolean;
};

export function isHabitCategory(value: unknown): value is HabitCategory {
  return HABIT_CATEGORIES.some((category) => category === value);
}

export function isHabitList(value: unknown): value is Habit[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;
      const habit = item as Record<string, unknown>;
      const hasLegacy = typeof habit.completed === "boolean";
      const hasCounts =
        typeof habit.targetCount === "number" &&
        Number.isFinite(habit.targetCount) &&
        typeof habit.completedCount === "number" &&
        Number.isFinite(habit.completedCount);
      return (
        typeof habit.id === "string" &&
        typeof habit.title === "string" &&
        isHabitCategory(habit.category) &&
        (hasLegacy || hasCounts)
      );
    })
  );
}

export function reviveHabits(list: Habit[]): Habit[] {
  let changed = false;
  const next = list.map((habit) => {
    const raw = habit as Habit & { completed?: boolean };
    const targetCount = clampHabitTarget(typeof raw.targetCount === "number" ? raw.targetCount : 1);
    const completedCount = Math.min(
      targetCount,
      Math.max(
        0,
        typeof raw.completedCount === "number"
          ? Math.round(raw.completedCount)
          : raw.completed
            ? targetCount
            : 0,
      ),
    );
    if (
      raw.targetCount !== targetCount ||
      raw.completedCount !== completedCount ||
      Object.prototype.hasOwnProperty.call(raw, "completed")
    ) {
      changed = true;
    }
    return {
      id: habit.id,
      title: habit.title,
      category: habit.category,
      targetCount,
      completedCount,
    };
  });
  return changed ? next : list;
}

export function isTodoList(value: unknown): value is Todo[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;
      const todo = item as Record<string, unknown>;
      const minutesOk =
        todo.focusMinutes == null || (typeof todo.focusMinutes === "number" && Number.isFinite(todo.focusMinutes));
      const categoryOk = todo.category == null || isHabitCategory(todo.category);
      return (
        typeof todo.id === "string" &&
        typeof todo.title === "string" &&
        TODO_PRIORITIES.some((priority) => priority === todo.priority) &&
        TODO_STATUSES.some((status) => status === todo.status) &&
        minutesOk &&
        categoryOk
      );
    })
  );
}

export function reviveTodos(list: Todo[]): Todo[] {
  let changed = false;
  const next = list.map((todo) => {
    const raw = todo.focusMinutes;
    const focusMinutes = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
    const category = isHabitCategory(todo.category) ? todo.category : "업무";
    if (raw !== focusMinutes || todo.category !== category) changed = true;
    return {
      id: todo.id,
      title: todo.title,
      priority: todo.priority,
      status: todo.status,
      focusMinutes,
      category,
    };
  });
  return changed ? next : list;
}

function isPomodoroSession(value: unknown): value is PomodoroSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === "string" &&
    (session.phase === "focus" || session.phase === "break") &&
    typeof session.minutes === "number" &&
    Number.isFinite(session.minutes) &&
    (session.todoId === null || typeof session.todoId === "string") &&
    typeof session.completedAt === "number" &&
    Number.isFinite(session.completedAt)
  );
}

export function isPomodoroState(value: unknown): value is PomodoroState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return (
    (state.phase === "focus" || state.phase === "break") &&
    typeof state.durationSec === "number" &&
    typeof state.remainingSec === "number" &&
    typeof state.running === "boolean" &&
    (state.endsAt === null || typeof state.endsAt === "number") &&
    typeof state.completedFocus === "number" &&
    typeof state.targetFocus === "number" &&
    (state.linkedTodoId == null || typeof state.linkedTodoId === "string") &&
    (state.sessions == null || (Array.isArray(state.sessions) && state.sessions.every(isPomodoroSession)))
  );
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isDailyRecord(value: unknown): value is DailyRecord {
  if (!value || typeof value !== "object") return false;
  const day = value as Record<string, unknown>;
  const categories = day.categories;
  const categoryOk =
    !!categories &&
    typeof categories === "object" &&
    HABIT_CATEGORIES.every((category) => {
      const minutes = (categories as Record<string, unknown>)[category];
      return minutes == null || finiteNumber(minutes);
    });
  return (
    typeof day.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    finiteNumber(day.habitDone) &&
    finiteNumber(day.habitTotal) &&
    (day.focusSessions == null || finiteNumber(day.focusSessions)) &&
    categoryOk
  );
}

export function isHistoryState(value: unknown): value is HistoryState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  const idsOk =
    state.importedSessionIds == null ||
    (Array.isArray(state.importedSessionIds) && state.importedSessionIds.every((id) => typeof id === "string"));
  return Array.isArray(state.days) && state.days.every(isDailyRecord) && idsOk;
}

export function reviveHistory(state: HistoryState): HistoryState {
  let changed = false;
  const days = state.days.map((day) => {
    const categories = {
      건강: Math.max(0, Math.round(day.categories?.건강 ?? 0)),
      학습: Math.max(0, Math.round(day.categories?.학습 ?? 0)),
      업무: Math.max(0, Math.round(day.categories?.업무 ?? 0)),
      마음: Math.max(0, Math.round(day.categories?.마음 ?? 0)),
    } satisfies Record<HabitCategory, number>;
    const focusSessions =
      typeof day.focusSessions === "number" && Number.isFinite(day.focusSessions)
        ? Math.max(0, Math.round(day.focusSessions))
        : 0;
    const habitDone = Math.max(0, Math.round(day.habitDone));
    const habitTotal = Math.max(0, Math.round(day.habitTotal));
    const sameCategories = HABIT_CATEGORIES.every((category) => day.categories?.[category] === categories[category]);
    if (!sameCategories || day.focusSessions !== focusSessions || day.habitDone !== habitDone || day.habitTotal !== habitTotal) {
      changed = true;
    }
    return { date: day.date, habitDone, habitTotal, focusSessions, categories };
  });
  const importedSessionIds = Array.isArray(state.importedSessionIds)
    ? state.importedSessionIds.filter((id) => typeof id === "string")
    : [];
  if (!Array.isArray(state.importedSessionIds)) changed = true;
  if (!changed) return state;
  return { days, importedSessionIds };
}

export function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.name === "string" &&
    typeof profile.role === "string" &&
    typeof profile.initials === "string" &&
    typeof profile.streak === "number" &&
    Number.isFinite(profile.streak)
  );
}

export function isUiState(value: unknown): value is UiState {
  if (!value || typeof value !== "object") return false;
  const ui = value as Record<string, unknown>;
  return typeof ui.sidebarCollapsed === "boolean";
}

export function nextTodoStatus(status: TodoStatus): TodoStatus {
  const index = TODO_STATUSES.indexOf(status);
  return TODO_STATUSES[(index + 1) % TODO_STATUSES.length];
}
