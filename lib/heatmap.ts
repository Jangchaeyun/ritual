import { addDays, keyToUtc, seoulDateKey, weekdayIndex } from "@/lib/analytics";
import { isHabitDone, type Habit, type HistoryState } from "@/lib/types";

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type HabitHeatCell = {
  date: string;
  inRange: boolean;
  rate: number | null;
  done: number | null;
  total: number | null;
  level: HeatLevel | null;
};

export type HabitHeatmapModel = {
  today: string;
  weeks: HabitHeatCell[][];
  recordedDays: number;
  averageRate: number;
};

const RANGE_DAYS = 30;

export function heatLevel(rate: number): HeatLevel {
  if (rate <= 0) return 0;
  if (rate <= 25) return 1;
  if (rate <= 50) return 2;
  if (rate <= 75) return 3;
  return 4;
}

function emptyCell(): HabitHeatCell {
  return { date: "", inRange: false, rate: null, done: null, total: null, level: null };
}

export function buildHabitHeatmap(history: HistoryState, habits: Habit[], now = Date.now()): HabitHeatmapModel {
  const today = seoulDateKey(now);
  const start = addDays(today, -(RANGE_DAYS - 1));
  const byDate = new Map(history.days.map((day) => [day.date, day]));
  const liveDone = habits.filter((habit) => isHabitDone(habit)).length;
  const liveTotal = habits.length;
  const gridStart = addDays(start, -weekdayIndex(keyToUtc(start)));
  const cells: HabitHeatCell[] = [];

  for (let cursor = gridStart; cursor <= today; cursor = addDays(cursor, 1)) {
    const inRange = cursor >= start;
    if (!inRange) {
      cells.push(emptyCell());
      continue;
    }
    const record = byDate.get(cursor);
    const done = cursor === today ? liveDone : (record?.habitDone ?? null);
    const total = cursor === today ? liveTotal : (record?.habitTotal ?? null);
    const hasRecord = cursor === today ? liveTotal > 0 : record != null && record.habitTotal > 0;
    const rate = hasRecord && total != null && total > 0 && done != null ? Math.round((done / total) * 100) : null;
    cells.push({
      date: cursor,
      inRange: true,
      rate,
      done: hasRecord ? done : null,
      total: hasRecord ? total : null,
      level: rate == null ? null : heatLevel(rate),
    });
    if (cells.length > 42) break;
  }

  const tail = (7 - (cells.length % 7)) % 7;
  for (let index = 0; index < tail; index += 1) cells.push(emptyCell());

  const weeks: HabitHeatCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));

  const recorded = cells.filter((cell) => cell.rate != null);
  const averageRate = recorded.length
    ? Math.round(recorded.reduce((total, cell) => total + (cell.rate ?? 0), 0) / recorded.length)
    : 0;

  return { today, weeks, recordedDays: recorded.length, averageRate };
}
