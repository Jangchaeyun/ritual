import type { HabitCategory } from "@/lib/types";

export const BOARD_FILTERS = [
  { id: "all", label: "전체" },
  { id: "exercise", label: "운동" },
  { id: "work", label: "업무" },
  { id: "growth", label: "자기계발" },
] as const;

export type BoardFilter = (typeof BOARD_FILTERS)[number]["id"];

const groups: Record<Exclude<BoardFilter, "all">, readonly HabitCategory[]> = {
  exercise: ["건강"],
  work: ["업무"],
  growth: ["학습", "마음"],
};

export function matchesBoardFilter(category: HabitCategory, filter: BoardFilter) {
  if (filter === "all") return true;
  return groups[filter].includes(category);
}
