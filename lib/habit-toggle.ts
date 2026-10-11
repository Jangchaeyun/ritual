import { isHabitDone, type Habit } from "@/lib/types";

export function applyHabitToggle(habits: Habit[], id: string) {
  const current = habits.find((habit) => habit.id === id);
  if (!current) return null;
  let streakDelta = 0;
  const next = habits.map((habit) => {
    if (habit.id !== id) return habit;
    if (isHabitDone(habit)) {
      streakDelta = -1;
      return { ...habit, completedCount: 0 };
    }
    const completedCount = Math.min(habit.targetCount, habit.completedCount + 1);
    if (completedCount >= habit.targetCount) streakDelta = 1;
    return { ...habit, completedCount };
  });
  return { habits: next, streakDelta };
}
