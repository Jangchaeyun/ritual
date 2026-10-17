import { addDays } from "@/lib/analytics";

export type StreakHabit = {
  id: string;
  targetCount: number;
};

export type StreakLog = {
  habitId: string;
  logDate: string;
};

function dateKey(value: string) {
  return value.slice(0, 10);
}

/**
 * 오늘을 제외하고, 목표를 모두 채운 날이 어제부터 며칠 이어지는지 셉니다.
 * 오늘이 아직 미완성이어도 스트릭은 끊기지 않습니다. 그날 반복 요일에 없는 습관은 건너뜁니다.
 * 습관이 하나도 없으면 0입니다. 날짜는 `YYYY-MM-DD`이고, 최대 400일까지만 거슬러 올라갑니다.
 */
export function consecutiveStreak(
  habits: StreakHabit[],
  logs: StreakLog[],
  today: string,
  occurs?: (habitId: string, date: string) => boolean,
) {
  if (habits.length === 0) return 0;
  const byDate = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const logDate = dateKey(log.logDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) continue;
    const counts = byDate.get(logDate) ?? new Map<string, number>();
    counts.set(log.habitId, (counts.get(log.habitId) ?? 0) + 1);
    byDate.set(logDate, counts);
  }

  let cursor = dateKey(today);
  let streak = 0;
  for (let step = 0; step < 400; step += 1) {
    const due = habits.filter((habit) => (occurs ? occurs(habit.id, cursor) : true));
    if (due.length === 0) {
      cursor = addDays(cursor, -1);
      continue;
    }
    const counts = byDate.get(cursor);
    const complete = due.every((habit) => (counts?.get(habit.id) ?? 0) >= habit.targetCount);
    if (!complete) {
      if (cursor === dateKey(today)) {
        cursor = addDays(cursor, -1);
        continue;
      }
      break;
    }
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
