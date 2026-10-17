"use client";

import { BoardFilterTabs } from "@/components/dashboard/board-filter-tabs";
import { HabitModal } from "@/components/habits/habit-modal";
import { useRoutine } from "@/components/routine-provider";
import { matchesBoardFilter, type BoardFilter } from "@/lib/board-filter";
import { Surface } from "@/components/ui/surface";
import { categoryStyles } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { seoulDateKey } from "@/lib/analytics";
import { defaultSchedule, occursOn, setRepeat, subscribeRepeat, getRepeatBook, getRepeatServerBook } from "@/lib/repeat";
import { RepeatMenu } from "@/components/ui/repeat-fields";
import { isHabitDone, type Habit, type HabitCategory } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ListChecks, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

function FlameBurst({ token }: { token: number }) {
  if (token === 0) return null;
  return (
    <span key={token} className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.span
            key={index}
            className="absolute top-1/2 left-1/2 text-sm"
            initial={{ opacity: 1, x: 0, y: 0, scale: 0.35 }}
            animate={{
              opacity: 0,
              x: Math.cos(angle) * 34,
              y: Math.sin(angle) * 28,
              scale: 1.05,
            }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            🔥
          </motion.span>
        );
      })}
    </span>
  );
}

export function HabitChecklist({
  manage = false,
  category = "all",
  boardFilters = false,
  delay = 0,
}: {
  manage?: boolean;
  category?: HabitCategory | "all";
  boardFilters?: boolean;
  delay?: number;
}) {
  const { habits, syncWarning, toggleHabit, removeHabit } = useRoutine();
  const repeat = useSyncExternalStore(subscribeRepeat, getRepeatBook, getRepeatServerBook);
  const [today, setToday] = useState("");
  const [open, setOpen] = useState(false);
  const [bursts, setBursts] = useState<Record<string, number>>({});
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  useEffect(() => {
    const tick = () => setToday(seoulDateKey(Date.now()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  const visible = habits.filter((habit) => {
    if (category !== "all" && habit.category !== category) return false;
    if (!matchesBoardFilter(habit.category, boardFilters ? boardFilter : "all")) return false;
    if (!manage && today && !occursOn(repeat.habits[habit.id], today)) return false;
    return true;
  });
  const done = visible.filter((habit) => isHabitDone(habit)).length;
  const ratio = visible.length === 0 ? 0 : done / visible.length;

  function onCheck(habit: Habit) {
    const willFinish = !isHabitDone(habit) && habit.completedCount + 1 >= habit.targetCount;
    toggleHabit(habit.id);
    if (!willFinish) return;
    setBursts((prev) => ({ ...prev, [habit.id]: (prev[habit.id] ?? 0) + 1 }));
  }

  return (
    <Surface delay={delay} className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-wash text-ink">
            <ListChecks className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-medium tracking-[-0.02em] text-ink">오늘의 습관 체크리스트</h2>
            <p className="mt-0.5 text-xs text-muted">목표 횟수를 채우면 스트릭이 올라갑니다</p>
            {syncWarning ? <p className="mt-1 text-xs text-warn">{syncWarning}</p> : null}
          </div>
        </div>
        <p className="rounded-full bg-wash px-2.5 py-1 font-mono text-xs text-ink">
          {done}/{visible.length}
        </p>
      </div>

      {boardFilters ? <BoardFilterTabs value={boardFilter} onChange={setBoardFilter} label="습관 분류" /> : null}

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-wash">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-300"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.map((habit) => {
            const complete = isHabitDone(habit);
            return (
              <motion.li
                key={habit.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-3 rounded-xl border border-line bg-field px-3 py-2.5"
              >
                <span className="relative">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={complete}
                    aria-label={`${habit.title} ${complete ? "완료 취소" : "한 번 체크"}`}
                    onClick={() => onCheck(habit)}
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                      complete
                        ? "border-transparent bg-fill text-on-fill"
                        : "border-line bg-field text-accent hover:border-ink",
                    )}
                  >
                    {complete ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </button>
                  <FlameBurst token={bursts[habit.id] ?? 0} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", complete ? "text-muted line-through" : "text-ink")}>
                    {habit.title}
                  </p>
                  <RepeatMenu
                    label="반복"
                    value={repeat.habits[habit.id] ?? defaultSchedule()}
                    onChange={(next) => setRepeat("habits", habit.id, next)}
                  />
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">
                  {habit.completedCount}/{habit.targetCount}
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", categoryStyles[habit.category])}>
                  {habit.category}
                </span>
                {manage ? (
                  <button
                    type="button"
                    onClick={() => removeHabit(habit.id)}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-wash hover:text-danger"
                    aria-label={`${habit.title} 삭제`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </motion.li>
            );
          })}
        </AnimatePresence>
        {visible.length === 0 ? (
          <li className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-field px-3 py-10 text-center text-sm text-muted">
            이 분류에는 아직 습관이 없어요
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-card text-sm font-medium text-ink transition hover:border-ink/25 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
      >
        <Plus className="size-4" />
        새 습관 추가
      </button>
      <HabitModal open={open} onClose={() => setOpen(false)} />
    </Surface>
  );
}
