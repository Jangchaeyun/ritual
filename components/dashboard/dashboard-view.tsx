"use client";

import { DailyReflection } from "@/components/dashboard/daily-reflection";
import { DailyReportCard } from "@/components/dashboard/daily-report-card";
import { HabitHeatmap } from "@/components/dashboard/habit-heatmap";
import { RankWidget } from "@/components/dashboard/rank-widget";
import { HabitChecklist } from "@/components/dashboard/habit-checklist";
import { StudyTimer } from "@/components/pomodoro/study-timer";
import { PomodoroTimer } from "@/components/pomodoro/pomodoro-timer";
import { TodoList } from "@/components/dashboard/todo-list";
import { useAccount } from "@/components/account-provider";
import { useRoutine } from "@/components/routine-provider";
import { panelClass } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { seoulDateKey } from "@/lib/analytics";
import { isTrackedFocus } from "@/lib/study-timer";
import { isHabitDone } from "@/lib/types";
import { BookOpen, CheckCircle2, ListTodo } from "lucide-react";
import { useState, type ReactNode } from "react";

function Metric({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className={cn(panelClass, "px-4 py-4")}>
      <p className="flex items-center gap-2 text-[11px] tracking-[0.12em] text-[#8a847c]">
        <span className="text-[#1c2430]">{icon}</span>
        {label}
      </p>
      <p className="mt-3 font-mono text-[1.65rem] font-medium tracking-[-0.03em] text-[#1c2430] tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[#8a847c]">{hint}</p>
    </div>
  );
}

function CardSkeleton() {
  return <div className="h-[440px] animate-pulse rounded-2xl border border-black/[0.06] bg-[#f3f0ea]" />;
}

export function DashboardView() {
  const account = useAccount();
  const { ready, habits, todos, pomodoro } = useRoutine();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const habitDone = habits.filter((habit) => isHabitDone(habit)).length;
  const openTodos = todos.filter((todo) => todo.status !== "done").length;
  const doneTodos = todos.filter((todo) => todo.status === "done").length;
  const goalRate = habits.length === 0 ? 0 : Math.round((habitDone / habits.length) * 100);
  const todayKey = seoulDateKey(Date.now());
  const focusMinutes = pomodoro.sessions
    .filter((session) => isTrackedFocus(session.todoId) && seoulDateKey(session.completedAt) === todayKey)
    .reduce((sum, session) => sum + session.minutes, 0);

  return (
    <div>
      {ready ? (
        <>
          <section className="mb-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <p className="text-[11px] font-medium tracking-[0.22em] text-[#8a847c]">TODAY</p>
                <h1 className="mt-2 text-[2rem] font-medium tracking-[-0.03em] text-[#1c2430]">오늘의 플래너</h1>
                <p className="mt-2 text-sm leading-6 break-keep text-[#6f6a64]">
                  {account.user
                    ? "할 일과 습관을 날짜처럼 펼쳐 두고, 공부한 시간은 기록으로 남겨 두세요."
                    : "할 일과 습관을 이 브라우저에 바로 남겨 두세요. 로그인하면 계정에도 저장됩니다."}
                </p>
              </div>
              <div className="w-full lg:max-w-xs">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="tracking-wide text-[#8a847c]">오늘의 목표</span>
                  <span className="font-medium text-[#1c2430] tabular-nums">{goalRate}%</span>
                </div>
                <div
                  className="h-1 overflow-hidden rounded-full bg-black/[0.06]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={goalRate}
                  aria-label="오늘의 습관 달성률"
                >
                  <div className="h-full rounded-full bg-[#1c2430] transition-[width] duration-300" style={{ width: `${goalRate}%` }} />
                </div>
                <p className="mt-2 text-xs text-[#8a847c]">
                  습관 {habitDone}/{habits.length} · 완료한 할 일 {doneTodos}
                </p>
              </div>
            </div>
          </section>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric icon={<BookOpen className="size-4" />} label="학습 시간" value={`${focusMinutes}분`} hint="오늘 기록한 공부·근무" />
            <Metric icon={<CheckCircle2 className="size-4" />} label="완료한 목표" value={String(habitDone)} hint={`습관 ${habits.length}개 중`} />
            <Metric icon={<ListTodo className="size-4" />} label="남은 할 일" value={String(openTodos)} hint="아직 끝나지 않은 항목" />
          </div>

          <div className="mb-5">
            <StudyTimer delay={0.08} />
          </div>

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <TodoList delay={0.05} />
            </div>
            <div className="xl:col-span-2">
              <details className={cn(panelClass, "px-1")}>
                <summary className="cursor-pointer px-4 py-3.5 text-sm font-medium text-[#1c2430]">포모도로</summary>
                <div className="px-2 pb-3">
                  <PomodoroTimer delay={0} />
                </div>
              </details>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <HabitChecklist boardFilters delay={0.05} />
            <RankWidget />
          </div>
          <div className="mt-5">
            <HabitHeatmap
              delay={0.04}
              selectedDate={selectedDate ?? seoulDateKey(Date.now())}
              onSelectDate={(date) => {
                setSelectedDate(date);
                document.getElementById("daily-reflection")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
            />
          </div>
          <DailyReportCard />
          <div className="mt-5">
            <DailyReflection date={selectedDate} onUseToday={() => setSelectedDate(null)} delay={0.1} />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
    </div>
  );
}
