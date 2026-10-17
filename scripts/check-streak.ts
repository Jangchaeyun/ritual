import { consecutiveStreak } from "../lib/streak";

const habits = [
  { id: "a", targetCount: 1 },
  { id: "b", targetCount: 1 },
  { id: "c", targetCount: 1 },
];
const logs = [
  { habitId: "a", logDate: "2026-10-11" },
  { habitId: "b", logDate: "2026-10-11" },
  { habitId: "a", logDate: "2026-10-12" },
  { habitId: "b", logDate: "2026-10-12" },
  { habitId: "c", logDate: "2026-10-12" },
];

const yesterday = consecutiveStreak(habits, logs, "2026-10-13");
if (yesterday !== 1) throw new Error(`expected 1, got ${yesterday}`);

const today = consecutiveStreak(
  habits,
  [
    ...logs,
    { habitId: "a", logDate: "2026-10-13" },
    { habitId: "b", logDate: "2026-10-13" },
    { habitId: "c", logDate: "2026-10-13" },
  ],
  "2026-10-13",
);
if (today !== 2) throw new Error(`expected 2, got ${today}`);

console.log("streak checks passed");
