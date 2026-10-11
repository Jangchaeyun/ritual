import { addDays } from "@/lib/analytics";

export type StreakHabit = {
  id: string;
  targetCount: number;
};

export type StreakLog = {
  habitId: string;
  logDate: string;
};

export function consecutiveStreak(habits: StreakHabit[], logs: StreakLog[], today: string) {
  if (habits.length === 0) return 0;
  const byDate = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const counts = byDate.get(log.logDate) ?? new Map<string, number>();
    counts.set(log.habitId, (counts.get(log.habitId) ?? 0) + 1);
    byDate.set(log.logDate, counts);
  }

  const complete = (date: string) => {
    const counts = byDate.get(date);
    return habits.every((habit) => (counts?.get(habit.id) ?? 0) >= habit.targetCount);
  };

  let cursor = complete(today) ? today : addDays(today, -1);
  let streak = 0;
  while (complete(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
    if (streak > 400) break;
  }
  return streak;
}
