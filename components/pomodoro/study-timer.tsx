"use client";

import { PaintedTimeline } from "@/components/pomodoro/painted-timeline";
import { useRoutine } from "@/components/routine-provider";
import { Surface } from "@/components/ui/surface";
import { addDays, formatFocus, seoulDateKey, weekdayIndex } from "@/lib/analytics";
import { WEEKDAY_LABELS, getRepeatBook, getRepeatServerBook, occursOn, subscribeRepeat } from "@/lib/repeat";
import { cn } from "@/lib/cn";
import { buildDaySpans, formatHm, recordedMinutes, sessionInterval, seoulHourStart } from "@/lib/hour-timeline";
import {
  beginStudyForTodo,
  clearStudyProgress,
  getStudyServerSnapshot,
  getStudySnapshot,
  hydrateStudyClock,
  setFocusPurpose,
  setStudyTodo,
  studyElapsedMs,
  sessionPurpose,
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
import { ChevronLeft, ChevronRight, Pause, Pencil, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

function mondayOf(dateKey: string) {
  return addDays(dateKey, -weekdayIndex(seoulHourStart(dateKey, 12)));
}

function formatHms(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function seoulStamp(dateKey: string, time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return seoulHourStart(dateKey, hour) + minute * 60_000;
}

export function StudyTimer({ delay = 0, variant = "card" }: { delay?: number; variant?: "card" | "hero" }) {
  const { todos, loggedSessions, recordStudySession, updateStudySession, removeStudySession } = useRoutine();
  const clock = useSyncExternalStore(subscribeStudyClock, getStudySnapshot, getStudyServerSnapshot);
  const repeat = useSyncExternalStore(subscribeRepeat, getRepeatBook, getRepeatServerBook);
  const timerColors = useSyncExternalStore(subscribeTimerColors, getTimerColorSnapshot, getTimerColorServerSnapshot);
  const [now, setNow] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState<string | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<string | null>(null);
  const [colorTodoId, setColorTodoId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ todoId: "", startDate: "", startTime: "", endDate: "", endTime: "" });

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
  const matchingTodos = todos.filter((todo) => {
    if (todo.status === "done" || !todoMatchesPurpose(todo.category, purpose)) return false;
    if (selectedDate && !occursOn(repeat.todos[todo.id], selectedDate)) return false;
    return true;
  });

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
      open:
        live && selectedDate === today
          ? {
              id: "open-clock",
              startedAt: origin,
              endedAt: openEnd,
              todoId: clock.todoId,
              title: selected?.title ?? null,
              running: clock.running,
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
  const dayRecords = useMemo(() => {
    if (!selectedDate) return [];
    const dayStart = seoulHourStart(selectedDate, 0);
    const dayEnd = seoulHourStart(selectedDate, 24);
    const seen = new Set<string>();
    const records: { id: string; todoId: string; title: string; start: number; end: number }[] = [];
    for (const session of loggedSessions) {
      if (seen.has(session.id) || sessionPurpose(session.todoId) !== purpose) continue;
      seen.add(session.id);
      const interval = sessionInterval(session);
      if (interval.end <= dayStart || interval.start >= dayEnd) continue;
      const todoId = studyTargetId(session.todoId);
      records.push({
        id: session.id,
        todoId: todoId ?? "",
        title: todos.find((todo) => todo.id === todoId)?.title ?? "할 일",
        start: interval.start,
        end: interval.end,
      });
    }
    return records.sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  }, [loggedSessions, purpose, selectedDate, todos]);
  const recordTodos = todos.filter((todo) => todoMatchesPurpose(todo.category, purpose));
  const currentMonday = today ? mondayOf(today) : "";
  const weekStart = weekAnchor && currentMonday && mondayOf(weekAnchor) <= currentMonday ? mondayOf(weekAnchor) : currentMonday;
  const week = weekStart ? WEEKDAY_LABELS.map((label, index) => ({ label, dateKey: addDays(weekStart, index) })) : [];
  const weekLabel = week[0] && week[6] ? `${Number(week[0].dateKey.slice(5, 7))}.${Number(week[0].dateKey.slice(8))} – ${Number(week[6].dateKey.slice(5, 7))}.${Number(week[6].dateKey.slice(8))}` : "";

  function shiftWeek(delta: number) {
    if (!weekStart || !currentMonday) return;
    const next = addDays(weekStart, delta * 7);
    if (next > currentMonday) return;
    setWeekAnchor(next);
    setViewDate(next === currentMonday ? null : next);
  }

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

  function beginEdit(record: { id: string; todoId: string; start: number; end: number }) {
    setConfirmId(null);
    setEditingId(record.id);
    setDraft({
      todoId: record.todoId,
      startDate: seoulDateKey(record.start),
      startTime: formatHm(record.start),
      endDate: seoulDateKey(record.end),
      endTime: formatHm(record.end),
    });
  }

  async function saveEdit(id: string) {
    const startedAt = seoulStamp(draft.startDate, draft.startTime);
    const endedAt = seoulStamp(draft.endDate, draft.endTime);
    if (startedAt == null || endedAt == null || endedAt <= startedAt) {
      setNotice("끝 시간을 시작보다 뒤로 정해 주세요.");
      return;
    }
    if (!draft.todoId) {
      setNotice("기록을 연결할 할 일을 골라 주세요.");
      return;
    }
    const saved = await updateStudySession({ id, todoId: draft.todoId, purpose, startedAt, endedAt });
    if (!saved) {
      setNotice("기록을 수정하지 못했습니다.");
      return;
    }
    setEditingId(null);
    setNotice("기록을 수정했습니다.");
  }

  async function deleteRecord(id: string) {
    const removed = await removeStudySession(id);
    setConfirmId(null);
    setEditingId((current) => (current === id ? null : current));
    setNotice(removed ? "기록을 삭제했습니다." : "기록을 삭제하지 못했습니다.");
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
          <p className="text-[11px] font-medium tracking-[0.22em] text-muted">{working ? "WORK" : "STUDY"}</p>
          <h2 className={cn("mt-1 font-medium tracking-[-0.02em] text-ink", hero ? "text-xl" : "text-base")}>
            {working ? "근무 타이머" : "공부 타이머"}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-wash p-1" role="group" aria-label="타이머 용도">
          <button
            type="button"
            aria-pressed={!working}
            onClick={() => choosePurpose("study")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
              !working ? "bg-fill text-on-fill" : "text-soft",
            )}
          >
            공부
          </button>
          <button
            type="button"
            aria-pressed={working}
            onClick={() => choosePurpose("work")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
              working ? "bg-fill text-on-fill" : "text-soft",
            )}
          >
            근무
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1">
        <button
          type="button"
          aria-label="이전 주"
          onClick={() => shiftWeek(-1)}
          className="grid size-8 shrink-0 place-items-center rounded-full text-soft hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
        >
          <ChevronLeft className="size-4" />
        </button>
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1" aria-label={weekLabel || "날짜"}>
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
                "flex flex-col items-center rounded-xl px-1 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                active ? "bg-fill text-on-fill" : "text-muted hover:bg-wash",
                future && "cursor-default opacity-40 hover:bg-transparent",
              )}
            >
              <span>{day.dateKey === today ? "오늘" : day.label}</span>
              <span className={cn("mt-0.5 font-mono text-sm tabular-nums", active ? "text-on-fill" : "text-ink")}>
                {Number(day.dateKey.slice(8))}
              </span>
            </button>
          );
        })}
      </div>
        <button
          type="button"
          aria-label="다음 주"
          disabled={!currentMonday || weekStart >= currentMonday}
          onClick={() => shiftWeek(1)}
          className="grid size-8 shrink-0 place-items-center rounded-full text-soft hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      {weekLabel ? <p className="mt-1 text-center text-[11px] text-muted">{weekLabel}</p> : null}

      <p
        className="mt-6 text-center font-mono text-5xl font-medium tracking-[-0.04em] text-ink tabular-nums sm:text-6xl"
        aria-live="polite"
        aria-label={working ? "이날의 근무 시간" : "이날의 공부 시간"}
      >
        {formatHms(dayTotalSec)}
      </p>
      <p className="mt-2 text-center text-xs tracking-wide text-muted">
        {clock.running && selected && selectedDate === today
          ? `${selected.title} 진행 중`
          : selectedDate === today
            ? "오늘 기록"
            : `${selectedDate} 기록`}
      </p>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted">타이머</p>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              {working ? "업무 할 일을 먼저 추가하세요." : "할 일을 먼저 추가하세요."}
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {rows.map(({ todo, seconds }) => {
                const running = clock.running && clock.todoId === todo.id;
                const color = colorForTodo(todo.id, timerColors);
                const picking = colorTodoId === todo.id;
                return (
                  <li key={todo.id} className={cn("rounded-xl px-1 py-1.5", clock.todoId === todo.id && "bg-wash")}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`${todo.title} 색상`}
                        onClick={() => setColorTodoId(picking ? null : todo.id)}
                        className="size-7 shrink-0 rounded-full ring-2 ring-card focus-visible:outline-none focus-visible:ring-ink/30"
                        style={{ background: color }}
                      />
                      <button
                        type="button"
                        aria-label={running ? `${todo.title} 일시정지` : `${todo.title} 시작`}
                        onClick={() => playTodo(todo.id)}
                        disabled={locked && clock.todoId !== todo.id}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-soft hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:opacity-30"
                      >
                        {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </button>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{todo.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">{formatHms(seconds)}</span>
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
                              "size-6 rounded-full ring-offset-2 ring-offset-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
                              color === swatch && "ring-2 ring-ink",
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
                          className="size-6 cursor-pointer rounded-full border border-line bg-card p-0"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 min-h-5 text-sm text-soft" aria-live="polite">
            {notice}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={finish}
              disabled={minutes <= 0 || !selected}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
                minutes > 0 && selected
                  ? "bg-fill text-on-fill"
                  : "cursor-not-allowed bg-wash text-faint",
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
              className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
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
        {dayRecords.length > 0 ? (
          <div className="mt-5 lg:col-span-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted">기록</p>
              <p className="text-[11px] text-muted">{dayRecords.length}개</p>
            </div>
            <ul className="mt-2 space-y-2">
              {dayRecords.map((record) => {
                const editing = editingId === record.id;
                const confirming = confirmId === record.id;
                const minutes = recordedMinutes(record.start, record.end);
                return (
                  <li key={record.id} className="rounded-2xl border border-line bg-card px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: colorForTodo(record.todoId, timerColors) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{record.title}</p>
                        <p className="mt-0.5 font-mono text-sm tabular-nums text-ink">
                          {formatHm(record.start)} – {formatHm(record.end)}
                          <span className="ml-2 font-sans text-[11px] text-muted">{formatFocus(minutes)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => beginEdit(record)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-field px-3 text-xs font-medium text-ink hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
                          aria-label={`${record.title} 기록 수정`}
                        >
                          <Pencil className="size-3.5" />
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setConfirmId(confirming ? null : record.id);
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/20 bg-field px-3 text-xs font-medium text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                          aria-label={`${record.title} 기록 삭제`}
                          aria-expanded={confirming}
                        >
                          <Trash2 className="size-3.5" />
                          삭제
                        </button>
                      </div>
                    </div>
                    {confirming ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warm px-3 py-2.5">
                        <p className="text-sm text-ink">이 기록을 삭제할까요?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="h-9 rounded-full px-3 text-xs font-medium text-soft hover:bg-card"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteRecord(record.id)}
                            className="h-9 rounded-full bg-danger px-3 text-xs font-medium text-on-ink"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {editing ? (
                      <div className="mt-3 space-y-3 border-t border-line pt-3">
                        <label className="block text-xs text-muted">
                          할 일
                          <select
                            value={draft.todoId}
                            onChange={(event) => setDraft((current) => ({ ...current, todoId: event.target.value }))}
                            className="mt-1 h-11 w-full rounded-xl border border-line bg-field px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-ink/15"
                          >
                            {recordTodos.map((todo) => (
                              <option key={todo.id} value={todo.id}>
                                {todo.title}
                              </option>
                            ))}
                            {draft.todoId && !recordTodos.some((todo) => todo.id === draft.todoId) ? (
                              <option value={draft.todoId}>{record.title}</option>
                            ) : null}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-xs text-muted">
                            시작
                            <input
                              type="time"
                              aria-label="시작 시각"
                              value={draft.startTime}
                              onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))}
                              className="mt-1 h-11 w-full rounded-xl border border-line bg-field px-3 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-ink/15"
                            />
                          </label>
                          <label className="block text-xs text-muted">
                            끝
                            <input
                              type="time"
                              aria-label="끝 시각"
                              value={draft.endTime}
                              onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))}
                              className="mt-1 h-11 w-full rounded-xl border border-line bg-field px-3 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-ink/15"
                            />
                          </label>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="h-9 rounded-full px-3 text-xs font-medium text-soft hover:bg-field"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveEdit(record.id)}
                            className="h-9 rounded-full bg-fill px-4 text-xs font-medium text-on-fill"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
