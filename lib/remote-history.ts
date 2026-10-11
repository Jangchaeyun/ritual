import { emptyCategories, seoulDateKey } from "@/lib/analytics";
import { sessionPurpose, studyTargetId } from "@/lib/study-timer";
import { isHabitDone, type Habit, type HabitCategory, type HistoryState, type PomodoroSession, type Todo } from "@/lib/types";

export type HabitLogPoint = {
  habitId: string;
  date: string;
};

function blankDay(date: string, habitTotal: number) {
  return { date, habitDone: 0, habitTotal, focusSessions: 0, categories: emptyCategories() };
}

function categoryOf(session: PomodoroSession, todos: Todo[]): HabitCategory {
  const purpose = sessionPurpose(session.todoId);
  const target = studyTargetId(session.todoId);
  if (purpose === "study" && !target) return "학습";
  if (purpose === "work" && !target) return "업무";
  const todo = todos.find((item) => item.id === (target || session.todoId));
  if (purpose === "study") return todo?.category ?? "학습";
  if (purpose === "work") return todo?.category ?? "업무";
  return todo?.category ?? "업무";
}

export function historyFromActivity(input: {
  habits: Habit[];
  todos: Todo[];
  logs: HabitLogPoint[];
  sessions: PomodoroSession[];
  now: number;
}): HistoryState {
  const habitTotal = input.habits.length;
  const counts = new Map<string, Map<string, number>>();
  for (const log of input.logs) {
    const byHabit = counts.get(log.date) ?? new Map<string, number>();
    byHabit.set(log.habitId, (byHabit.get(log.habitId) ?? 0) + 1);
    counts.set(log.date, byHabit);
  }

  const days = new Map<string, ReturnType<typeof blankDay>>();
  for (const [date, byHabit] of counts) {
    let habitDone = 0;
    for (const habit of input.habits) {
      const count = byHabit.get(habit.id) ?? 0;
      if (habit.targetCount > 0 && count >= habit.targetCount) habitDone += 1;
    }
    days.set(date, { ...blankDay(date, habitTotal), habitDone });
  }

  const imported: string[] = [];
  for (const session of input.sessions) {
    if (session.phase !== "focus" || session.minutes <= 0) continue;
    const date = seoulDateKey(session.completedAt);
    const current = days.get(date) ?? blankDay(date, habitTotal);
    const category = categoryOf(session, input.todos);
    days.set(date, {
      ...current,
      focusSessions: current.focusSessions + 1,
      categories: { ...current.categories, [category]: current.categories[category] + session.minutes },
    });
    imported.push(session.id);
  }

  const today = seoulDateKey(input.now);
  const todayRecord = days.get(today) ?? blankDay(today, habitTotal);
  days.set(today, {
    ...todayRecord,
    habitDone: input.habits.filter((habit) => isHabitDone(habit)).length,
    habitTotal,
  });

  return {
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-120),
    importedSessionIds: imported.slice(-300),
  };
}
