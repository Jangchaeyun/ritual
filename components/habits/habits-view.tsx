"use client";

import { HabitChecklist } from "@/components/dashboard/habit-checklist";
import { PageHeader } from "@/components/layout/page-header";
import { useRoutine } from "@/components/routine-provider";
import { cn } from "@/lib/cn";
import { HABIT_CATEGORIES, type HabitCategory } from "@/lib/types";
import { useState } from "react";

const filters: Array<{ id: HabitCategory | "all"; label: string }> = [
  { id: "all", label: "전체" },
  ...HABIT_CATEGORIES.map((category) => ({ id: category, label: category })),
];

export function HabitsView() {
  const { ready } = useRoutine();
  const [filter, setFilter] = useState<HabitCategory | "all">("all");

  return (
    <div>
      <PageHeader
        kicker="HABITS"
        title="습관 관리"
        description="카테고리로 걸러 보고, 새 습관은 체크리스트의 추가 버튼에서 목표 횟수와 함께 등록합니다."
      />

      {ready ? (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                  filter === item.id
                    ? "bg-fill text-on-fill"
                    : "bg-card text-soft ring-1 ring-line hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <HabitChecklist manage category={filter} />
        </div>
      ) : (
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-paper" />
      )}
    </div>
  );
}
