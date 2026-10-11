import {
  HABIT_CATEGORIES,
  isHabitDone,
  type DailyRecord,
  type Habit,
  type HabitCategory,
  type HistoryState,
  type PomodoroSession,
  type Todo,
} from "@/lib/types";
import { sessionPurpose, studyTargetId } from "@/lib/study-timer";

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"] as const;
const WEEKDAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type AnalyticsRange = "week" | "month";

export type TrendPoint = {
  date: string;
  label: string;
  rate: number | null;
  focusMinutes: number;
};

export type CategoryShare = {
  category: HabitCategory;
  minutes: number;
  percent: number;
};

export function emptyCategories(): Record<HabitCategory, number> {
  return { 건강: 0, 학습: 0, 업무: 0, 마음: 0 };
}

export function seoulDateKey(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export function weekdayIndex(now: number) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(now));
  const index = WEEKDAY_EN.indexOf(weekday);
  return index < 0 ? 0 : index;
}

export function keyToUtc(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1, 3, 0, 0);
}

export function addDays(key: string, amount: number) {
  return seoulDateKey(keyToUtc(key) + amount * 86_400_000);
}

export function sumCategories(categories: Record<HabitCategory, number>) {
  return HABIT_CATEGORIES.reduce((total, category) => total + (categories[category] ?? 0), 0);
}

export function formatFocus(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}분`;
  if (rest === 0) return `${hours}시간`;
  return `${hours}시간 ${rest}분`;
}

function blankDay(date: string): DailyRecord {
  return { date, habitDone: 0, habitTotal: 0, focusSessions: 0, categories: emptyCategories() };
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

export function reconcileHistory(
  prev: HistoryState,
  input: { habits: Habit[]; todos: Todo[]; sessions: PomodoroSession[]; now: number },
): HistoryState {
  const imported = new Set(prev.importedSessionIds);
  const days = new Map(
    prev.days.map((day) => [
      day.date,
      { ...day, categories: { ...emptyCategories(), ...day.categories } },
    ]),
  );
  let changed = false;

  for (const session of input.sessions) {
    if (session.phase !== "focus" || session.minutes <= 0 || imported.has(session.id)) continue;
    const date = seoulDateKey(session.completedAt);
    const current = days.get(date) ?? blankDay(date);
    const category = categoryOf(session, input.todos);
    days.set(date, {
      ...current,
      focusSessions: current.focusSessions + 1,
      categories: { ...current.categories, [category]: current.categories[category] + session.minutes },
    });
    imported.add(session.id);
    changed = true;
  }

  const today = seoulDateKey(input.now);
  const habitDone = input.habits.filter((habit) => isHabitDone(habit)).length;
  const habitTotal = input.habits.length;
  const currentToday = days.get(today) ?? blankDay(today);
  if (
    !days.has(today) ||
    currentToday.habitDone !== habitDone ||
    currentToday.habitTotal !== habitTotal
  ) {
    days.set(today, { ...currentToday, habitDone, habitTotal });
    changed = true;
  }

  if (!changed) return prev;

  return {
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-120),
    importedSessionIds: [...imported].slice(-300),
  };
}

export function periodDates(range: AnalyticsRange, now: number) {
  const today = seoulDateKey(now);
  if (range === "week") {
    const start = addDays(today, -weekdayIndex(now));
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }
  const monthPrefix = today.slice(0, 7);
  const dates: string[] = [];
  for (let cursor = `${monthPrefix}-01`; cursor.slice(0, 7) === monthPrefix; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
    if (dates.length > 31) break;
  }
  return dates;
}

export function buildDashboard(
  history: HistoryState,
  habits: Habit[],
  todos: Todo[],
  sessions: PomodoroSession[],
  range: AnalyticsRange,
  now = Date.now(),
) {
  const projected = reconcileHistory(history, { habits, todos, sessions, now });
  const today = seoulDateKey(now);
  const dates = periodDates(range, now);
  const points: TrendPoint[] = dates.map((date) => {
    const record = projected.days.find((day) => day.date === date);
    const future = date > today;
    const rate =
      !future && record && record.habitTotal > 0 ? Math.round((record.habitDone / record.habitTotal) * 100) : null;
    return {
      date,
      label: range === "week" ? WEEKDAY_KO[weekdayIndex(keyToUtc(date))] : String(Number(date.slice(8))),
      rate,
      focusMinutes: record && !future ? sumCategories(record.categories) : 0,
    };
  });

  const totals = emptyCategories();
  let sessionsInRange = 0;
  for (const date of dates) {
    if (date > today) continue;
    const record = projected.days.find((day) => day.date === date);
    if (!record) continue;
    sessionsInRange += record.focusSessions;
    for (const category of HABIT_CATEGORIES) totals[category] += record.categories[category] ?? 0;
  }
  const focusTotal = sumCategories(totals);
  const categories: CategoryShare[] = HABIT_CATEGORIES.map((category) => ({
    category,
    minutes: totals[category],
    percent: focusTotal > 0 ? Math.round((totals[category] / focusTotal) * 100) : 0,
  }));

  const elapsed = points.filter((point) => point.date <= today);
  let bestStreak = 0;
  let run = 0;
  for (const point of elapsed) {
    if (point.rate === 100) {
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }
  const rated = elapsed.filter((point) => point.rate != null);
  const averageRate = rated.length
    ? Math.round(rated.reduce((total, point) => total + (point.rate ?? 0), 0) / rated.length)
    : 0;

  return {
    points,
    categories,
    summary: {
      bestStreak,
      averageRate,
      focusMinutes: elapsed.reduce((total, point) => total + point.focusMinutes, 0),
      sessions: sessionsInRange,
    },
  };
}
