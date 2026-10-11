"use client";

import { PaintedTimeline } from "@/components/pomodoro/painted-timeline";
import { useRoutine } from "@/components/routine-provider";
import { Surface } from "@/components/ui/surface";
import { addDays, seoulDateKey } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { buildDaySpans, recordedMinutes, seoulHourStart } from "@/lib/hour-timeline";
import {
  beginStudyForTodo,
  clearStudyProgress,
  getStudyServerSnapshot,
  getStudySnapshot,
  hydrateStudyClock,
  setFocusPurpose,
  setStudyTodo,
  studyElapsedMs,
  studyMinutes,
  studyTargetId,
  subscribeStudyClock,
  todoMatchesPurpose,
  toggleStudyClock,
  type FocusPurpose,
} from "@/lib/study-timer";
import {
  TIMER_PALETTE,
  colorForTodo,
  getTimerColorServerSnapshot,
  getTimerColorSnapshot,
  hydrateTimerColors,
  setTimerColor,
  subscribeTimerColors,
} from "@/lib/timer-colors";
import type { Todo } from "@/lib/types";
import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

function formatHms(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function mondayOf(dateKey: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(
    new Date(seoulHourStart(dateKey, 12)),
  );
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return addDays(dateKey, index < 0 ? 0 : -index);
}

export function StudyTimer({ delay = 0, variant = "card" }: { delay?: number; variant?: "card" | "hero" }) {
  const { todos, loggedSessions, recordStudySession } = useRoutine();
  const clock = useSyncExternalStore(subscribeStudyClock, getStudySnapshot, getStudyServerSnapshot);
  const timerColors = useSyncExternalStore(subscribeTimerColors, getTimerColorSnapshot, getTimerColorServerSnapshot);
  const [now, setNow] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState<string | null>(null);
  const [colorTodoId, setColorTodoId] = useState<string | null>(null);

  useEffect(() => {
    hydrateStudyClock();
    hydrateTimerColors();
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!clock.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [clock.running]);

  const elapsedMs = now == null ? clock.accumulatedMs : studyElapsedMs(clock, now);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const minutes = studyMinutes(elapsedMs);
  const today = now == null ? "" : seoulDateKey(now);
  const selectedDate = viewDate && today && viewDate <= today ? viewDate : today;
  const purpose: FocusPurpose = clock.purpose === "work" ? "work" : "study";
  const working = purpose === "work";
  const selected = todos.find((todo) => todo.id === clock.todoId) ?? null;
  const locked = clock.running || elapsedMs > 0;
  const matchingTodos = todos.filter((todo) => todo.status !== "done" && todoMatchesPurpose(todo.category, purpose));

  useEffect(() => {
    if (clock.running || clock.accumulatedMs > 0 || !selected) return;
    if (!todoMatchesPurpose(selected.category, purpose)) {
      setStudyTodo(null);
      setColorTodoId(null);
    }
  }, [clock.accumulatedMs, clock.running, purpose, selected]);

  const spans = useMemo(() => {
    if (!selectedDate || now == null) return [];
    const origin =
      clock.originStartedAt ??
      (clock.startedAt != null ? clock.startedAt - clock.accumulatedMs : now - clock.accumulatedMs);
    const openEnd = clock.running ? now : origin + clock.accumulatedMs;
    const live = clock.todoId != null && (clock.running || clock.accumulatedMs > 0) && openEnd > origin;
    return buildDaySpans({
      dateKey: selectedDate,
      now,
      purpose,
      sessions: loggedSessions,
      open: live
        ? {
            id: "open-clock",
            startedAt: origin,
            endedAt: openEnd,
            todoId: clock.todoId,
            title: selected?.title ?? null,
            running: clock.running && selectedDate === today,
          }
        : null,
      titleFor: (todoId) => {
        const targetId = studyTargetId(todoId);
        return todos.find((todo) => todo.id === targetId)?.title ?? null;
      },
    });
  }, [
    clock.accumulatedMs,
    clock.originStartedAt,
    clock.running,
    clock.startedAt,
    clock.todoId,
    loggedSessions,
    now,
    purpose,
    selected?.title,
    selectedDate,
    today,
    todos,
  ]);

  const dayTotalSec = Math.floor(spans.reduce((sum, span) => sum + Math.max(0, span.end - span.start), 0) / 1000);
  const weekStart = selectedDate ? mondayOf(selectedDate) : "";
  const week = weekStart ? WEEKDAYS.map((label, index) => ({ label, dateKey: addDays(weekStart, index) })) : [];

  const rows = useMemo(() => {
    const byId = new Map<string, Todo>();
    for (const todo of matchingTodos) byId.set(todo.id, todo);
    for (const span of spans) {
      if (!span.todoId || byId.has(span.todoId)) continue;
      const todo = todos.find((item) => item.id === span.todoId);
      if (todo && todoMatchesPurpose(todo.category, purpose)) byId.set(todo.id, todo);
    }
    return [...byId.values()]
      .map((todo) => ({
        todo,
        seconds: Math.floor(
          spans.filter((span) => span.todoId === todo.id).reduce((sum, span) => sum + Math.max(0, span.end - span.start), 0) / 1000,
        ),
      }))
      .sort((left, right) => right.seconds - left.seconds || left.todo.title.localeCompare(right.todo.title, "ko"));
  }, [matchingTodos, purpose, spans, todos]);

  const hero = variant === "hero";

  function playTodo(todoId: string) {
    setNotice(null);
    if (clock.todoId === todoId && (clock.running || elapsedMs > 0)) {
      toggleStudyClock();
      setNow(Date.now());
      return;
    }
    if (!beginStudyForTodo(todoId, purpose)) {
      setNotice("시간을 기록하거나 리셋한 뒤 다른 할 일로 바꿀 수 있습니다.");
      return;
    }
    setNow(Date.now());
  }

  function finish() {
    if (!clock.todoId || !selected) {
      setNotice("기록할 할 일을 골라 주세요.");
      return;
    }
    const endedAt = Date.now();
    const elapsed = studyElapsedMs(clock, endedAt);
    const startedAt = clock.originStartedAt ?? endedAt - elapsed;
    const recorded = recordedMinutes(startedAt, endedAt);
    if (recorded <= 0) {
      setNotice(working ? "조금 더 근무한 뒤 기록해 주세요." : "조금 더 공부한 뒤 기록해 주세요.");
      return;
    }
    recordStudySession({ todoId: clock.todoId, purpose, startedAt, endedAt });
    clearStudyProgress();
    setNow(Date.now());
    setNotice(`${selected.title}에 ${working ? "근무" : "공부"} ${recorded}분을 기록했습니다.`);
  }

  function choosePurpose(next: FocusPurpose) {
    if (next === purpose) return;
    if (!setFocusPurpose(next)) {
      setNotice("시간을 기록하거나 리셋한 뒤 모드를 바꿀 수 있습니다.");
      return;
    }
    setColorTodoId(null);
    setNotice(null);
  }

  return (
    <Surface delay={delay} className={cn("flex h-full flex-col p-4 sm:p-5", hero && "w-full")}>
      <div id="study-timer" className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-[#8a847c]">{working ? "WORK" : "STUDY"}</p>
          <h2 className={cn("mt-1 font-medium tracking-[-0.02em] text-[#1c2430]", hero ? "text-xl" : "text-base")}>
            {working ? "근무 타이머" : "공부 타이머"}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.04] p-1" role="group" aria-label="타이머 용도">
          <button
            type="button"
            aria-pressed={!working}
            onClick={() => choosePurpose("study")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
              !working ? "bg-[#1c2430] text-white" : "text-[#6f6a64]",
            )}
          >
            공부
          </button>
          <button
            type="button"
            aria-pressed={working}
            onClick={() => choosePurpose("work")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
              working ? "bg-[#1c2430] text-white" : "text-[#6f6a64]",
            )}
          >
            근무
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1" aria-label="이번 주">
        {week.map((day) => {
          const future = Boolean(today) && day.dateKey > today;
          const active = day.dateKey === selectedDate;
          return (
            <button
              key={day.dateKey}
              type="button"
              disabled={future}
              onClick={() => setViewDate(day.dateKey === today ? null : day.dateKey)}
              className={cn(
                "flex flex-col items-center rounded-xl px-1 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20",
                active ? "bg-[#1c2430] text-white" : "text-[#8a847c] hover:bg-black/[0.04]",
                future && "cursor-default opacity-40 hover:bg-transparent",
              )}
            >
              <span>{day.dateKey === today ? "오늘" : day.label}</span>
              <span className={cn("mt-0.5 font-mono text-sm tabular-nums", active ? "text-white" : "text-[#1c2430]")}>
                {Number(day.dateKey.slice(8))}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="mt-6 text-center font-mono text-5xl font-medium tracking-[-0.04em] text-[#1c2430] tabular-nums sm:text-6xl"
        aria-live="polite"
        aria-label={working ? "이날의 근무 시간" : "이날의 공부 시간"}
      >
        {formatHms(dayTotalSec)}
      </p>
      <p className="mt-2 text-center text-xs tracking-wide text-[#8a847c]">
        {clock.running && selected ? `${selected.title} 진행 중` : selectedDate === today ? "오늘 기록" : `${selectedDate} 기록`}
      </p>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-[#8a847c]">타이머</p>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-[#8a847c]">
              {working ? "업무 할 일을 먼저 추가하세요." : "할 일을 먼저 추가하세요."}
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {rows.map(({ todo, seconds }) => {
                const running = clock.running && clock.todoId === todo.id;
                const color = colorForTodo(todo.id, timerColors);
                const picking = colorTodoId === todo.id;
                return (
                  <li key={todo.id} className={cn("rounded-xl px-1 py-1.5", clock.todoId === todo.id && "bg-black/[0.035]")}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`${todo.title} 색상`}
                        onClick={() => setColorTodoId(picking ? null : todo.id)}
                        className="size-7 shrink-0 rounded-full ring-2 ring-white focus-visible:outline-none focus-visible:ring-[#1c2430]/30"
                        style={{ background: color }}
                      />
                      <button
                        type="button"
                        aria-label={running ? `${todo.title} 일시정지` : `${todo.title} 시작`}
                        onClick={() => playTodo(todo.id)}
                        disabled={locked && clock.todoId !== todo.id}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[#6f6a64] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20 disabled:opacity-30"
                      >
                        {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </button>
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1c2430]">{todo.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#8a847c] tabular-nums">{formatHms(seconds)}</span>
                    </div>
                    {picking ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1" role="group" aria-label={`${todo.title} 색 선택`}>
                        {TIMER_PALETTE.map((swatch) => (
                          <button
                            key={swatch}
                            type="button"
                            aria-label={swatch}
                            aria-pressed={color === swatch}
                            onClick={() => setTimerColor(todo.id, swatch)}
                            className={cn(
                              "size-6 rounded-full ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/30",
                              color === swatch && "ring-2 ring-[#1c2430]",
                            )}
                            style={{ background: swatch }}
                          />
                        ))}
                        <label className="sr-only" htmlFor={`timer-color-${todo.id}`}>
                          직접 고르기
                        </label>
                        <input
                          id={`timer-color-${todo.id}`}
                          aria-label={`${todo.title} 색 직접 고르기`}
                          type="color"
                          value={color}
                          onChange={(event) => setTimerColor(todo.id, event.target.value)}
                          className="size-6 cursor-pointer rounded-full border border-black/[0.06] bg-white p-0"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 min-h-5 text-sm text-[#6f6a64]" aria-live="polite">
            {notice}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={finish}
              disabled={minutes <= 0 || !selected}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
                minutes > 0 && selected
                  ? "bg-[#1c2430] text-white"
                  : "cursor-not-allowed bg-black/[0.04] text-[#b7b1a8]",
              )}
            >
              <Square className="size-4" />
              기록하기
            </button>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                clearStudyProgress();
                setNow(Date.now());
              }}
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-sm text-[#1c2430] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20"
            >
              <RotateCcw className="size-4" />
              리셋
            </button>
          </div>
        </div>
        <PaintedTimeline
          dateKey={selectedDate || today}
          todayKey={today}
          now={now}
          spans={spans}
          colorFor={(todoId) => colorForTodo(todoId, timerColors)}
        />
      </div>
    </Surface>
  );
}
