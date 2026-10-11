"use client";

import { BoardFilterTabs } from "@/components/dashboard/board-filter-tabs";
import { GoogleCalendarPanel, type CalendarView } from "@/components/dashboard/google-calendar-panel";
import { useRoutine } from "@/components/routine-provider";
import { matchesBoardFilter, type BoardFilter } from "@/lib/board-filter";
import { HABIT_CATEGORIES, type HabitCategory } from "@/lib/types";
import { Surface } from "@/components/ui/surface";
import { priorityMeta, statusMeta } from "@/lib/labels";
import { cn } from "@/lib/cn";
import {
  beginStudyForTodo,
  getStudyServerSnapshot,
  getStudySnapshot,
  hydrateStudyClock,
  subscribeStudyClock,
} from "@/lib/study-timer";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { BookOpen, Check, GripVertical, ListTodo, Timer, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

function isCalendarEvent(value: unknown): value is GoogleCalendarEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    typeof event.start === "string" &&
    typeof event.end === "string" &&
    typeof event.allDay === "boolean" &&
    (event.href === null || typeof event.href === "string")
  );
}

export function TodoList({ delay = 0 }: { delay?: number }) {
  const { todos, pomodoro, syncWarning, cycleTodoStatus, toggleTodoDone, addTodo, removeTodo, reorderTodos, startFocusForTodo } = useRoutine();
  const study = useSyncExternalStore(subscribeStudyClock, getStudySnapshot, getStudyServerSnapshot);
  const [draft, setDraft] = useState("");
  const [draftCategory, setDraftCategory] = useState<HabitCategory>("업무");
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const visible = todos.filter((todo) => matchesBoardFilter(todo.category, boardFilter));
  const openCount = visible.filter((todo) => todo.status !== "done").length;
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [tab, setTab] = useState<"todo" | "calendar">(searchParams.get("calendar") === "1" || authError ? "calendar" : "todo");
  const [calendar, setCalendar] = useState<CalendarView>({ status: "idle" });
  const requestId = useRef(0);

  useEffect(() => {
    hydrateStudyClock();
  }, []);

  function onDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) return;
    const fromId = visible[result.source.index]?.id;
    const toId = visible[result.destination.index]?.id;
    const from = todos.findIndex((todo) => todo.id === fromId);
    const to = todos.findIndex((todo) => todo.id === toId);
    if (from < 0 || to < 0) return;
    reorderTodos(from, to);
  }

  async function loadCalendar() {
    const id = requestId.current + 1;
    requestId.current = id;
    setCalendar({ status: "loading" });
    try {
      const response = await fetch("/api/calendar/today", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (requestId.current !== id) return;
      const error =
        payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : null;
      if (response.status === 503 || error === "missing_config") {
        setCalendar({ status: "missing_config" });
        return;
      }
      if (response.status === 401 || error === "unauthorized") {
        setCalendar({ status: "unauthorized" });
        return;
      }
      if (response.status === 403 || error === "permission" || error === "not_enabled") {
        setCalendar({ status: error === "not_enabled" ? "not_enabled" : "permission" });
        return;
      }
      if (!response.ok || !payload || typeof payload !== "object" || !("events" in payload) || !Array.isArray(payload.events)) {
        setCalendar({ status: "error" });
        return;
      }
      const account =
        "account" in payload && payload.account && typeof payload.account === "object" ? payload.account : null;
      const accountName =
        account && "name" in account && typeof account.name === "string" ? account.name : null;
      setCalendar({
        status: "ready",
        accountName,
        events: payload.events.filter(isCalendarEvent),
      });
    } catch {
      if (requestId.current === id) setCalendar({ status: "error" });
    }
  }

  function submitTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("title");
    const title = (field instanceof HTMLInputElement ? field.value : draft).trim();
    if (!title) return;
    addTodo({ title, category: draftCategory });
    setDraft("");
  }

  const calendarBoot = useRef(false);
  useEffect(() => {
    if (calendarBoot.current) return;
    if (searchParams.get("calendar") !== "1" && !searchParams.get("error")) return;
    calendarBoot.current = true;
    setTab("calendar");
    void loadCalendar();
  }, [searchParams]);

  function openCalendar() {
    setTab("calendar");
    void loadCalendar();
  }

  return (
    <Surface delay={delay} className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.04] text-[#1c2430]">
            <ListTodo className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-medium tracking-[-0.02em] text-[#1c2430]">우선순위 Todo 목록</h2>
            <p className="mt-0.5 text-xs text-[#8a847c]">
              {tab === "todo"
                ? "순서를 바꾸고, 타이머로 이 작업의 몰입 시간을 쌓습니다"
                : "Google Calendar에서 가져온 오늘 일정입니다"}
            </p>
          </div>
        </div>
        <p className="rounded-full bg-black/[0.04] px-2.5 py-1 text-xs text-[#1c2430]">
          {tab === "todo" ? `남음 ${openCount}` : "오늘"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-black/[0.04] p-1" role="tablist" aria-label="할 일 패널">
        <button
          type="button"
          role="tab"
          id="todo-tab"
          aria-selected={tab === "todo"}
          aria-controls="todo-panel"
          onClick={() => setTab("todo")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
            tab === "todo" ? "bg-[#1c2430] text-white" : "text-[#6f6a64] hover:text-[#1c2430]",
          )}
        >
          할 일
        </button>
        <button
          type="button"
          role="tab"
          id="calendar-tab"
          aria-selected={tab === "calendar"}
          aria-controls="calendar-panel"
          onClick={openCalendar}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
            tab === "calendar"
              ? "bg-[#1c2430] text-white"
              : "text-[#6f6a64] hover:text-[#1c2430]",
          )}
        >
          구글 일정
        </button>
      </div>

      {tab === "todo" ? (
        <>
          <BoardFilterTabs value={boardFilter} onChange={setBoardFilter} label="할 일 분류" />
          <form onSubmit={submitTodo} className="mt-3 flex gap-2">
            <input
              name="title"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onCompositionEnd={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                const title = event.currentTarget.value.trim();
                if (!title) return;
                addTodo({ title, category: draftCategory });
                setDraft("");
              }}
              aria-label="할 일"
              placeholder="할 일을 입력하세요"
              autoComplete="off"
              enterKeyHint="done"
              className="min-w-0 flex-1 rounded-xl border border-black/[0.06] bg-[#faf8f5] px-3 py-2 text-sm text-[#1c2430] outline-none ring-[#1c2430]/15 placeholder:text-[#b7b1a8] focus:ring-2"
            />
            <select
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value as HabitCategory)}
              aria-label="할 일 카테고리"
              className="rounded-xl border border-black/[0.06] bg-[#faf8f5] px-2 text-xs text-[#1c2430] outline-none ring-[#1c2430]/15 focus:ring-2"
            >
              {HABIT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="shrink-0 rounded-full bg-[#1c2430] px-3.5 py-2 text-sm font-medium text-white"
            >
              추가
            </button>
          </form>
          {syncWarning?.includes("할 일") ? (
            <p className="mt-2 text-xs text-[#8a5a32]">{syncWarning}</p>
          ) : null}
        </>
      ) : null}

      {tab === "calendar" ? (
        <div id="calendar-panel" role="tabpanel" aria-labelledby="calendar-tab">
          <GoogleCalendarPanel view={calendar} authError={authError} onReload={() => void loadCalendar()} />
        </div>
      ) : (
      <div id="todo-panel" role="tabpanel" aria-labelledby="todo-tab" className="flex flex-1 flex-col">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="priority-todos">
          {(provided) => (
            <ul
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="mt-4 flex max-h-80 min-h-16 flex-1 flex-col gap-2 overflow-y-auto"
            >
              {visible.map((todo, index) => {
                const priority = priorityMeta[todo.priority];
                const status = statusMeta[todo.status];
                const done = todo.status === "done";
                const tracking = pomodoro.linkedTodoId === todo.id && pomodoro.phase === "focus" && pomodoro.running;
                const studying = study.todoId === todo.id && (study.running || study.accumulatedMs > 0);
                return (
                  <Draggable key={todo.id} draggableId={todo.id} index={index}>
                    {(item, snapshot) => (
                      <li
                        ref={item.innerRef}
                        {...item.draggableProps}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border border-black/[0.06] border-l-2 bg-[#faf8f5] px-2 py-2",
                          priority.accent,
                          done && "opacity-60",
                          snapshot.isDragging && "shadow-[0_16px_32px_-18px_rgba(28,36,48,0.28)] ring-1 ring-black/10",
                          tracking && "ring-1 ring-[#1c2430]/20",
                        )}
                      >
                        <button
                          type="button"
                          className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg text-[#8a847c] active:cursor-grabbing"
                          aria-label={`${todo.title} 순서 변경`}
                          {...item.dragHandleProps}
                        >
                          <GripVertical className="size-4" />
                        </button>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={done}
                          aria-label={`${todo.title} ${done ? "미완료로 변경" : "완료"}`}
                          onClick={() => toggleTodoDone(todo.id)}
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20",
                            done
                              ? "border-transparent bg-[#1c2430] text-white"
                              : "border-black/[0.1] bg-[#faf8f5] text-transparent hover:border-[#1c2430]",
                          )}
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </button>
                        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", priority.chip)}>
                          {priority.label}
                        </span>
                        <p className={cn("min-w-0 flex-1 truncate text-sm", done ? "text-[#8a847c] line-through" : "text-[#1c2430]")}>
                          {todo.title}
                          {todo.focusMinutes > 0 ? (
                            <span className="ml-2 font-mono text-[11px] text-[#3d5f7a]/90">{todo.focusMinutes}분</span>
                          ) : null}
                        </p>
                        <button
                          type="button"
                          onClick={() => cycleTodoStatus(todo.id)}
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20",
                            status.chip,
                          )}
                          aria-label={`${todo.title} 상태 변경, 현재 ${status.label}`}
                        >
                          {status.label}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            beginStudyForTodo(todo.id, todo.category === "업무" ? "work" : "study");
                            document.getElementById("study-timer")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                          }}
                          aria-pressed={studying}
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20",
                            studying
                              ? "border-[#1c2430] bg-[#1c2430] text-white"
                              : "border-black/[0.08] text-[#6f6a64] hover:border-[#1c2430] hover:text-[#1c2430]",
                          )}
                          aria-label={`${todo.title} ${todo.category === "업무" ? "근무" : "공부"} 타이머`}
                        >
                          <BookOpen className="size-3.5" />
                          {todo.category === "업무" ? "근무" : "공부"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startFocusForTodo(todo.id)}
                          aria-pressed={tracking}
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20",
                            tracking
                              ? "border-[#1c2430] bg-[#1c2430] text-white"
                              : "border-black/[0.08] text-[#6f6a64] hover:border-[#1c2430]/25 hover:text-[#1c2430]",
                          )}
                          aria-label={`${todo.title} 이 작업으로 타이머 시작`}
                        >
                          <Timer className="size-3.5" />
                          타이머
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTodo(todo.id)}
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#8a847c] transition hover:bg-black/[0.04] hover:text-[#9a4d55]"
                          aria-label={`${todo.title} 삭제`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
              {visible.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-black/[0.06] bg-[#faf8f5] px-3 py-10 text-center text-sm text-[#8a847c]">
                  이 분류에는 아직 할 일이 없어요
                </li>
              ) : null}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
      </div>
      )}
    </Surface>
  );
}
