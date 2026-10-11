import { emptyCategories, reconcileHistory, seoulDateKey } from "@/lib/analytics";
import {
  HABIT_CATEGORIES,
  isHabitDone,
  type Habit,
  type HabitCategory,
  type HistoryState,
  type PomodoroSession,
  type Todo,
} from "@/lib/types";

export type HabitSnapshot = {
  title: string;
  category: HabitCategory;
  completedCount: number;
  targetCount: number;
};

export type DailyReportInput = {
  date: string;
  completedHabits: HabitSnapshot[];
  openHabits: HabitSnapshot[];
  focusMinutes: number;
  focusSessions: number;
  focusByCategory: Record<HabitCategory, number>;
  streak: number;
};

export type DailyReport = {
  productivity: string;
  strength: string;
  improvement: string;
};

function cleanTitle(title: string) {
  return title.replace(/[\u0000-\u001F]/g, "").trim().slice(0, 80);
}

function snapshot(habit: Habit): HabitSnapshot | null {
  const title = cleanTitle(habit.title);
  if (!title) return null;
  const targetCount = Math.min(7, Math.max(1, Math.round(habit.targetCount)));
  const completedCount = Math.min(targetCount, Math.max(0, Math.round(habit.completedCount)));
  return { title, category: habit.category, completedCount, targetCount };
}

export function buildDailyReportInput(input: {
  habits: Habit[];
  todos: Todo[];
  sessions: PomodoroSession[];
  history: HistoryState;
  streak: number;
  now?: number;
}): DailyReportInput {
  const now = input.now ?? Date.now();
  const projected = reconcileHistory(input.history, {
    habits: input.habits,
    todos: input.todos,
    sessions: input.sessions,
    now,
  });
  const date = seoulDateKey(now);
  const record = projected.days.find((day) => day.date === date);
  const focusByCategory = emptyCategories();
  for (const category of HABIT_CATEGORIES) {
    focusByCategory[category] = Math.min(24 * 60, Math.max(0, Math.round(record?.categories[category] ?? 0)));
  }
  const completedHabits: HabitSnapshot[] = [];
  const openHabits: HabitSnapshot[] = [];

  for (const habit of input.habits) {
    const item = snapshot(habit);
    if (!item) continue;
    if (isHabitDone(habit)) completedHabits.push(item);
    else openHabits.push(item);
    if (completedHabits.length >= 30 && openHabits.length >= 30) break;
  }

  return {
    date,
    completedHabits: completedHabits.slice(0, 30),
    openHabits: openHabits.slice(0, 30),
    focusMinutes: HABIT_CATEGORIES.reduce((total, category) => total + focusByCategory[category], 0),
    focusSessions: Math.min(200, Math.max(0, Math.round(record?.focusSessions ?? 0))),
    focusByCategory,
    streak: Math.min(9999, Math.max(0, Math.round(input.streak))),
  };
}
