"use client";

import { BoardFilterTabs } from "@/components/dashboard/board-filter-tabs";
import { GoogleCalendarPanel, type CalendarView } from "@/components/dashboard/google-calendar-panel";
import { useRoutine } from "@/components/routine-provider";
import { matchesBoardFilter, type BoardFilter } from "@/lib/board-filter";
import { RepeatFields, RepeatMenu } from "@/components/ui/repeat-fields";
import { seoulDateKey } from "@/lib/analytics";
import {
  defaultSchedule,
  getRepeatBook,
  getRepeatServerBook,
  occursOn,
  setRepeat,
  subscribeRepeat,
  type RepeatSchedule,
} from "@/lib/repeat";
import { HABIT_CATEGORIES, type HabitCategory, type Todo } from "@/lib/types";
import { Surface } from "@/components/ui/surface";
import { priorityMeta, statusMeta } from "@/lib/labels";
import { cn } from "@/lib/cn";
import {
  beginStudyForTodo,
  getStudyServerSnapshot,
  getStudySnapshot,
  hydrateStudyClock,
  sessionPurpose,
  studyTargetId,
  subscribeStudyClock,
} from "@/lib/study-timer";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { BookOpen, Check, GripVertical, ListTodo, Pencil, Timer, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

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

type TodoDraft = { title: string; category: HabitCategory };

function TodoEditor({
  draft,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  draft: TodoDraft;
  error: string | null;
  onChange: (next: TodoDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <input
        value={draft.title}
        onChange={(event) => onChange({ ...draft, title: event.target.value })}
        onCompositionEnd={(event) => onChange({ ...draft, title: event.currentTarget.value })}
        aria-label="할 일 이름"
        autoComplete="off"
        className="min-w-0 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none ring-ink/15 focus:ring-2"
      />
      <select
        value={draft.category}
        onChange={(event) => onChange({ ...draft, category: event.target.value as HabitCategory })}
        aria-label="할 일 카테고리"
        className="rounded-xl border border-line bg-card px-2 py-2 text-xs text-ink outline-none ring-ink/15 focus:ring-2"
      >
        {HABIT_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-xs text-soft">
          취소
        </button>
        <button type="submit" className="rounded-full bg-fill px-3 py-1.5 text-xs font-medium text-on-fill">
          저장
        </button>
      </div>
    </form>
  );
}

export function TodoList({ delay = 0 }: { delay?: number }) {
  const { todos, pomodoro, loggedSessions, syncWarning, cycleTodoStatus, toggleTodoDone, addTodo, updateTodo, removeTodo, reorderTodos, startFocusForTodo } = useRoutine();
  const study = useSyncExternalStore(subscribeStudyClock, getStudySnapshot, getStudyServerSnapshot);
  const repeat = useSyncExternalStore(subscribeRepeat, getRepeatBook, getRepeatServerBook);
  const [today, setToday] = useState("");
  const [draft, setDraft] = useState("");
  const [draftCategory, setDraftCategory] = useState<HabitCategory>("업무");
  const [schedule, setSchedule] = useState<RepeatSchedule>(defaultSchedule);
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TodoDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setToday(seoulDateKey(Date.now()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  const visible = todos.filter((todo) => {
    if (!matchesBoardFilter(todo.category, boardFilter)) return false;
    if (today && !occursOn(repeat.todos[todo.id], today)) return false;
    return true;
  });
  const resting = todos.filter((todo) => {
    if (!today || !matchesBoardFilter(todo.category, boardFilter)) return false;
    return !occursOn(repeat.todos[todo.id], today);
  });
  const openCount = visible.filter((todo) => todo.status !== "done").length;
  const todayMinutes = useMemo(() => {
    const totals = new Map<string, number>();
    if (!today) return totals;
    for (const session of loggedSessions) {
      if (session.phase !== "focus" || session.minutes <= 0) continue;
      if (seoulDateKey(session.completedAt) !== today) continue;
      const purpose = sessionPurpose(session.todoId);
      const target = purpose ? studyTargetId(session.todoId) : session.todoId;
      if (!target) continue;
      totals.set(target, (totals.get(target) ?? 0) + session.minutes);
    }
    return totals;
  }, [loggedSessions, today]);
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

  function beginEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditDraft({ title: todo.title, category: todo.category });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingId || !editDraft) return;
    if (!editDraft.title.trim()) {
      setEditError("이름을 입력해 주세요.");
      return;
    }
    const saved = await updateTodo(editingId, editDraft);
    if (!saved) {
      setEditError("저장하지 못했습니다.");
      return;
    }
    cancelEdit();
  }

  function submitTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("title");
    const title = (field instanceof HTMLInputElement ? field.value : draft).trim();
    if (!title) return;
    addTodo({ title, category: draftCategory, schedule });
    setDraft("");
    setSchedule(defaultSchedule());
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
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-wash text-ink">
            <ListTodo className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-medium tracking-[-0.02em] text-ink">우선순위 Todo 목록</h2>
            <p className="mt-0.5 text-xs text-muted">
              {tab === "todo"
                ? "순서를 바꾸고, 타이머로 이 작업의 몰입 시간을 쌓습니다"
                : "Google Calendar에서 가져온 오늘 일정입니다"}
            </p>
          </div>
        </div>
        <p className="rounded-full bg-wash px-2.5 py-1 text-xs text-ink">
          {tab === "todo" ? `남음 ${openCount}` : "오늘"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-wash p-1" role="tablist" aria-label="할 일 패널">
        <button
          type="button"
          role="tab"
          id="todo-tab"
          aria-selected={tab === "todo"}
          aria-controls="todo-panel"
          onClick={() => setTab("todo")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
            tab === "todo" ? "bg-fill text-on-fill" : "text-soft hover:text-ink",
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
            "rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25",
            tab === "calendar"
              ? "bg-fill text-on-fill"
              : "text-soft hover:text-ink",
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
                addTodo({ title, category: draftCategory, schedule });
                setDraft("");
                setSchedule(defaultSchedule());
              }}
              aria-label="할 일"
              placeholder="할 일을 입력하세요"
              autoComplete="off"
              enterKeyHint="done"
              className="min-w-0 flex-1 rounded-xl border border-line bg-field px-3 py-2 text-sm text-ink outline-none ring-ink/15 placeholder:text-faint focus:ring-2"
            />
            <select
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value as HabitCategory)}
              aria-label="할 일 카테고리"
              className="rounded-xl border border-line bg-field px-2 text-xs text-ink outline-none ring-ink/15 focus:ring-2"
            >
              {HABIT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="shrink-0 rounded-full bg-fill px-3.5 py-2 text-sm font-medium text-on-fill"
            >
              추가
            </button>
          </form>
          <div className="mt-3">
            <RepeatFields value={schedule} onChange={setSchedule} />
          </div>
          {syncWarning?.includes("할 일") ? (
            <p className="mt-2 text-xs text-warn">{syncWarning}</p>
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
                          "rounded-xl border border-line border-l-2 bg-field px-2 py-2",
                          priority.accent,
                          done && "opacity-60",
                          snapshot.isDragging && "shadow-[0_16px_32px_-18px_rgba(28,36,48,0.28)] ring-1 ring-black/10",
                          tracking && "ring-1 ring-ink/20",
                        )}
                      >
                        <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg text-muted active:cursor-grabbing"
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
                            "grid size-8 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                            done
                              ? "border-transparent bg-fill text-on-fill"
                              : "border-line bg-field text-transparent hover:border-ink",
                          )}
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm", done ? "text-muted line-through" : "text-ink")}>
                            {todo.title}
                            {(todayMinutes.get(todo.id) ?? 0) > 0 ? (
                              <span className="ml-2 font-mono text-[11px] text-accent/90">{todayMinutes.get(todo.id)}분</span>
                            ) : null}
                          </p>
                          <RepeatMenu
                            label="반복"
                            value={repeat.todos[todo.id] ?? defaultSchedule()}
                            onChange={(next) => setRepeat("todos", todo.id, next)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => cycleTodoStatus(todo.id)}
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
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
                            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                            studying
                              ? "border-fill bg-fill text-on-fill"
                              : "border-line text-soft hover:border-ink hover:text-ink",
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
                            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                            tracking
                              ? "border-fill bg-fill text-on-fill"
                              : "border-line text-soft hover:border-ink/25 hover:text-ink",
                          )}
                          aria-label={`${todo.title} 이 작업으로 타이머 시작`}
                        >
                          <Timer className="size-3.5" />
                          타이머
                        </button>
                        <button
                          type="button"
                          onClick={() => (editingId === todo.id ? cancelEdit() : beginEdit(todo))}
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-wash hover:text-ink"
                          aria-label={`${todo.title} 수정`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTodo(todo.id)}
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-wash hover:text-danger"
                          aria-label={`${todo.title} 삭제`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                        </div>
                        {editingId === todo.id && editDraft ? (
                          <TodoEditor
                            draft={editDraft}
                            error={editError}
                            onChange={(next) => {
                              setEditDraft(next);
                              setEditError(null);
                            }}
                            onCancel={cancelEdit}
                            onSave={() => void saveEdit()}
                          />
                        ) : null}
                      </li>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
              {visible.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-line bg-field px-3 py-10 text-center text-sm text-muted">
                  오늘은 이 분류의 할 일이 없어요
                </li>
              ) : null}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
      {resting.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-muted">오늘은 아닌 반복</p>
          <ul className="mt-2 flex flex-col gap-2">
            {resting.map((todo) => (
              <li key={todo.id} className="rounded-xl border border-line bg-field px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm text-soft">{todo.title}</p>
                  <button
                    type="button"
                    onClick={() => (editingId === todo.id ? cancelEdit() : beginEdit(todo))}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-wash hover:text-ink"
                    aria-label={`${todo.title} 수정`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTodo(todo.id)}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-wash hover:text-danger"
                    aria-label={`${todo.title} 삭제`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {editingId === todo.id && editDraft ? (
                  <TodoEditor
                    draft={editDraft}
                    error={editError}
                    onChange={(next) => {
                      setEditDraft(next);
                      setEditError(null);
                    }}
                    onCancel={cancelEdit}
                    onSave={() => void saveEdit()}
                  />
                ) : null}
                <RepeatMenu
                  label="반복"
                  value={repeat.todos[todo.id] ?? defaultSchedule()}
                  onChange={(next) => setRepeat("todos", todo.id, next)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>
      )}
    </Surface>
  );
}
