"use client";

/**
 * 습관, 할 일, 공부·근무 타이머, 회고를 화면 전체에서 같이 씁니다.
 * 로그인 상태의 기록은 Supabase에 두고, 반복 요일과 테마처럼 계정 설정은 preferences에 저장합니다.
 */

import { useAccount } from "@/components/account-provider";
import { useActivity } from "@/hooks/use-activity";
import { useHabits } from "@/hooks/use-habits";
import { useJournals } from "@/hooks/use-journals";
import { useHydrated, useLocalStorage } from "@/hooks/use-local-storage";
import { useTodos } from "@/hooks/use-todos";
import {
  STORAGE_KEYS,
  sampleHabits,
  sampleHistory,
  samplePomodoro,
  sampleProfile,
  sampleReflections,
  sampleTodos,
  sampleUi,
} from "@/lib/sample-data";
import { reconcileHistory, seoulDateKey } from "@/lib/analytics";
import {
  clearTodoDone,
  forgetRepeat,
  getRepeatBook,
  hydrateRepeatBook,
  markTodoDone,
  occursOn,
  setHabitDay,
  setRepeat,
  subscribeRepeat,
  type RepeatSchedule,
} from "@/lib/repeat";
import { consecutiveStreak } from "@/lib/streak";
import { subscribeTheme } from "@/lib/theme";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  applyAccountPreferences,
  currentAccountPreferences,
  loadAccountPreferences,
  saveAccountPreferences,
} from "@/lib/account-preferences";
import { historyFromActivity } from "@/lib/remote-history";
import { recordedMinutes } from "@/lib/hour-timeline";
import {
  clampBreakMinutes,
  clampFocusMinutes,
  completePomodoroPhase,
  durationForPhase,
  earnedPhaseMinutes,
  remainingSeconds,
  rememberTimerLengths,
  revivePomodoro,
  subscribeTimerLengths,
} from "@/lib/pomodoro";
import { applyAmbientSettings, pauseAmbient, playAmbient, subscribeAmbient } from "@/lib/ambient-audio";
import type { RitualBackup } from "@/lib/backup";
import { applyFocusAlertEnabled, notifyFocusEnded, subscribeFocusAlert } from "@/lib/focus-alert";
import { playSessionChime, primeSessionAudio } from "@/lib/session-chime";
import { focusSessionTodoId, isTrackedFocus, studyTargetId, type FocusPurpose } from "@/lib/study-timer";
import { subscribeTimerColors } from "@/lib/timer-colors";
import {
  isHabitDone,
  isHabitList,
  isHistoryState,
  isPomodoroState,
  isProfile,
  isReflectionLog,
  isTodoList,
  isUiState,
  nextTodoStatus,
  reviveHabits,
  reviveHistory,
  reviveReflections,
  reviveTodos,
  MAX_REFLECTION_LENGTH,
  clampHabitTarget,
  type ReflectionLog,
  type HabitCategory,
  type HistoryState,
  type Todo,
  type TodoPriority,
  type TodoStatus,
  type PomodoroPhase,
  type PomodoroSession,
  type PomodoroState,
} from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type SessionNotice = {
  token: number;
  finishedPhase: PomodoroPhase;
  minutes: number;
  todoId: string | null;
  todoTitle: string | null;
};

type RoutineContextValue = {
  ready: boolean;
  profile: typeof sampleProfile;
  habits: typeof sampleHabits;
  todos: typeof sampleTodos;
  pomodoro: typeof samplePomodoro;
  history: HistoryState;
  reflections: ReflectionLog;
  sidebarCollapsed: boolean;
  remainingSec: number;
  progress: number;
  toggleHabit: (id: string) => void;
  addHabit: (input: {
    title: string;
    category: HabitCategory;
    targetCount: number;
    schedule: RepeatSchedule;
  }) => void;
  removeHabit: (id: string) => void;
  cycleTodoStatus: (id: string) => void;
  toggleTodoDone: (id: string) => void;
  addTodo: (input: {
    title: string;
    category: HabitCategory;
    priority?: TodoPriority;
    schedule: RepeatSchedule;
  }) => void;
  updateTodo: (id: string, input: { title: string; category: HabitCategory }) => Promise<boolean>;
  removeTodo: (id: string) => void;
  reorderTodos: (from: number, to: number) => void;
  toggleSidebar: () => void;
  sessionNotice: SessionNotice | null;
  setPomodoroPhase: (phase: PomodoroPhase) => void;
  startFocusForTodo: (todoId: string) => void;
  startPausePomodoro: () => void;
  resetPomodoro: () => void;
  skipPomodoroPhase: () => void;
  setPomodoroLengths: (focusMinutes: number, breakMinutes: number) => void;
  loggedSessions: PomodoroSession[];
  recordStudySession: (input: { todoId: string; purpose?: FocusPurpose; startedAt: number; endedAt: number }) => void;
  updateStudySession: (input: {
    id: string;
    todoId: string;
    purpose?: FocusPurpose;
    startedAt: number;
    endedAt: number;
  }) => Promise<boolean>;
  removeStudySession: (id: string) => Promise<boolean>;
  importRoutine: (backup: RitualBackup) => void;
  setReflection: (date: string, text: string) => void;
  syncWarning: string | null;
};

const profileOptions = { validate: isProfile };
const habitOptions = { validate: isHabitList, revive: reviveHabits };
const todoOptions = { validate: isTodoList, revive: reviveTodos };
const pomodoroOptions = { validate: isPomodoroState, revive: revivePomodoro };
const uiOptions = { validate: isUiState };
const historyOptions = { validate: isHistoryState, revive: reviveHistory };
const reflectionOptions = { validate: isReflectionLog, revive: reviveReflections };

const RoutineContext = createContext<RoutineContextValue | null>(null);

function withTodoStatus(todos: Todo[], id: string, status: TodoStatus) {
  if (status === "todo") clearTodoDone(id);
  else markTodoDone(id, seoulDateKey(Date.now()));
  return todos.map((todo) => (todo.id === id ? { ...todo, status } : todo));
}

function isRemoteSession(value: unknown): value is PomodoroSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === "string" &&
    (session.phase === "focus" || session.phase === "break") &&
    typeof session.minutes === "number" &&
    Number.isFinite(session.minutes) &&
    (session.todoId === null || typeof session.todoId === "string") &&
    typeof session.completedAt === "number" &&
    Number.isFinite(session.completedAt)
  );
}

export function RoutineProvider({ children }: { children: ReactNode }) {
  const profile = useLocalStorage(STORAGE_KEYS.profile, sampleProfile, profileOptions);
  const habits = useLocalStorage(STORAGE_KEYS.habits, sampleHabits, habitOptions);
  const todos = useLocalStorage(STORAGE_KEYS.todos, sampleTodos, todoOptions);
  const pomodoro = useLocalStorage(STORAGE_KEYS.pomodoro, samplePomodoro, pomodoroOptions);
  const ui = useLocalStorage(STORAGE_KEYS.ui, sampleUi, uiOptions);
  const history = useLocalStorage(STORAGE_KEYS.history, sampleHistory, historyOptions);
  const reflections = useLocalStorage(STORAGE_KEYS.reflections, sampleReflections, reflectionOptions);
  const [now, setNow] = useState<number | null>(null);
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null);
  const account = useAccount();
  const habitRemote = useHabits();
  const todoRemote = useTodos();
  const journalRemote = useJournals();
  const activityRemote = useActivity();
  const remote = Boolean(account.user);
  const hydrated = useHydrated();
  const setPomodoro = pomodoro.setValue;
  const setTodos = todos.setValue;
  const setUi = ui.setValue;
  const pomodoroRunning = pomodoro.value.running;
  const pomodoroRef = useRef(pomodoro.value);
  const todosRef = useRef(todos.value);
  const sessionsRef = useRef<PomodoroSession[]>([]);
  const profileRef = useRef(profile.value);
  const sessionsApplied = useRef(false);
  const prefsApplied = useRef<string | null>(null);
  const seenAccount = useRef<string | null | undefined>(undefined);
  const accountUserId = account.user?.id ?? null;
  const [sessionsReady, setSessionsReady] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  if (seenAccount.current !== accountUserId) {
    seenAccount.current = accountUserId;
    sessionsApplied.current = false;
    prefsApplied.current = null;
    if (sessionsReady) setSessionsReady(false);
    if (prefsReady) setPrefsReady(false);
  }
  const ready =
    hydrated &&
    (!remote ||
      (habitRemote.loaded && todoRemote.loaded && journalRemote.loaded && activityRemote.loaded && prefsReady));
  const settling = useRef(false);
  const noticeToken = useRef(0);

  const setHistory = history.setValue;

  const displayedHabits = remote ? habitRemote.habits : habits.value;
  const displayedTodos = remote ? todoRemote.todos : todos.value;
  const displayedReflections = remote ? journalRemote.notes : reflections.value;
  const displayedHistory = useMemo(() => {
    if (!remote) return history.value;
    const nowMs = Date.now();
    const base = historyFromActivity({
      habits: displayedHabits,
      todos: displayedTodos,
      logs: activityRemote.logs,
      sessions: activityRemote.sessions,
      now: nowMs,
    });
    return reconcileHistory(base, {
      habits: displayedHabits,
      todos: displayedTodos,
      sessions: pomodoro.value.sessions ?? [],
      now: nowMs,
    });
  }, [
    activityRemote.logs,
    activityRemote.sessions,
    displayedHabits,
    displayedTodos,
    history.value,
    pomodoro.value.sessions,
    remote,
  ]);

  useEffect(() => {
    pomodoroRef.current = pomodoro.value;
    todosRef.current = displayedTodos;
    profileRef.current = profile.value;
  }, [displayedTodos, pomodoro.value, profile.value]);

  useEffect(() => {
    if (!ready || remote) return;
    setHistory((prev) =>
      reconcileHistory(prev, {
        habits: displayedHabits,
        todos: displayedTodos,
        sessions: pomodoro.value.sessions ?? [],
        now: Date.now(),
      }),
    );
  }, [displayedHabits, displayedTodos, pomodoro.value.sessions, ready, remote, setHistory]);

  const updatePomodoro = useCallback(
    (updater: (prev: PomodoroState) => PomodoroState) => {
      setPomodoro((prev) => {
        const next = updater(prev);
        pomodoroRef.current = next;
        return next;
      });
    },
    [setPomodoro],
  );

  const commitPhaseEnd = useCallback(
    (prev: PomodoroState, tick: number) => {
      if (settling.current) return;
      settling.current = true;
      pauseAmbient();
      const minutes = earnedPhaseMinutes(prev, tick);
      const linked = prev.phase === "focus" ? (prev.linkedTodoId ?? null) : null;
      const todoTitle = linked ? (todosRef.current.find((todo) => todo.id === linked)?.title ?? null) : null;
      const session: PomodoroSession = {
        id: crypto.randomUUID(),
        phase: prev.phase,
        minutes,
        todoId: linked,
        completedAt: tick,
      };
      const next: PomodoroState = {
        ...completePomodoroPhase(prev),
        sessions: [session, ...(prev.sessions ?? [])].slice(0, 20),
      };
      pomodoroRef.current = next;
      setPomodoro(next);
      if (linked && minutes > 0) {
        if (remote) {
          const current = todosRef.current.find((todo) => todo.id === linked);
          if (current) {
            const focusMinutes = current.focusMinutes + minutes;
            todosRef.current = todosRef.current.map((todo) =>
              todo.id === linked ? { ...todo, focusMinutes } : todo,
            );
            void todoRemote.patch(linked, { focusMinutes });
          }
        } else {
          setTodos((list) => {
            let changed = false;
            const updated = list.map((todo) => {
              if (todo.id !== linked) return todo;
              changed = true;
              return { ...todo, focusMinutes: todo.focusMinutes + minutes };
            });
            return changed ? updated : list;
          });
        }
      }
      if (remote) {
        void fetch("/api/pomodoro/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session }),
        });
      }
      noticeToken.current += 1;
      setSessionNotice({
        token: noticeToken.current,
        finishedPhase: prev.phase,
        minutes,
        todoId: linked,
        todoTitle,
      });
      playSessionChime(prev.phase);
      if (prev.phase === "focus") {
        notifyFocusEnded({ minutes, todoTitle });
      }
      settling.current = false;
    },
    [remote, setPomodoro, setTodos, todoRemote.patch],
  );

  useEffect(() => {
    if (!ready || !pomodoroRunning) return;

    const sync = (tick: number) => {
      setNow(tick);
      const current = pomodoroRef.current;
      if (!current.running || current.endsAt == null || tick < current.endsAt) return;
      commitPhaseEnd(current, tick);
    };

    const id = window.setInterval(() => sync(Date.now()), 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [commitPhaseEnd, pomodoroRunning, ready]);

  const setHabits = habits.setValue;
  const setProfile = profile.setValue;

  const toggleHabit = useCallback(
    (id: string) => {
      if (remote) {
        const result = habitRemote.toggle(id);
        if (!result) return;
        const before = profileRef.current.streak;
        if (result.streakDelta !== 0) {
          const streak = Math.max(0, before + result.streakDelta);
          profileRef.current = { ...profileRef.current, streak };
          setProfile(profileRef.current);
        }
        void result.done
          .then((body) => {
            profileRef.current = { ...profileRef.current, streak: body.streak };
            setProfile(profileRef.current);
          })
          .catch(() => {
            profileRef.current = { ...profileRef.current, streak: before };
            setProfile(profileRef.current);
          });
        return;
      }
      let streakDelta = 0;
      setHabits((prev) =>
        prev.map((habit) => {
          if (habit.id !== id) return habit;
          if (isHabitDone(habit)) {
            streakDelta = -1;
            return { ...habit, completedCount: 0 };
          }
          const completedCount = Math.min(habit.targetCount, habit.completedCount + 1);
          if (completedCount >= habit.targetCount) streakDelta = 1;
          return { ...habit, completedCount };
        }),
      );
      if (streakDelta !== 0) {
        setProfile((prev) => ({ ...prev, streak: Math.max(0, prev.streak + streakDelta) }));
      }
    },
    [habitRemote.toggle, remote, setHabits, setProfile],
  );

  const addHabit = useCallback(
    (input: { title: string; category: HabitCategory; targetCount: number; schedule: RepeatSchedule }) => {
      const title = input.title.trim();
      if (!title) return;
      const targetCount = clampHabitTarget(input.targetCount);
      const id = crypto.randomUUID();
      setRepeat("habits", id, input.schedule);
      if (remote) {
        void habitRemote.add({ id, title, category: input.category, targetCount });
        return;
      }
      setHabits((prev) => [
        ...prev,
        { id, title, category: input.category, targetCount, completedCount: 0 },
      ]);
    },
    [habitRemote.add, remote, setHabits],
  );

  const removeHabit = useCallback(
    (id: string) => {
      forgetRepeat("habits", id);
      if (remote) {
        void habitRemote.remove(id);
        return;
      }
      setHabits((prev) => prev.filter((habit) => habit.id !== id));
    },
    [habitRemote.remove, remote, setHabits],
  );

  const cycleTodoStatus = useCallback(
    (id: string) => {
      if (remote) {
        const current = todosRef.current.find((todo) => todo.id === id);
        if (!current) return;
        const next = withTodoStatus(todosRef.current, id, nextTodoStatus(current.status));
        todosRef.current = next;
        const status = next.find((todo) => todo.id === id)?.status;
        if (status) void todoRemote.patch(id, { status });
        return;
      }
      setTodos((prev) => {
        const current = prev.find((todo) => todo.id === id);
        if (!current) return prev;
        return withTodoStatus(prev, id, nextTodoStatus(current.status));
      });
    },
    [remote, setTodos, todoRemote.patch],
  );

  const toggleTodoDone = useCallback(
    (id: string) => {
      const nextStatus = (status: TodoStatus) => (status === "done" ? "todo" : "done");
      if (remote) {
        const current = todosRef.current.find((todo) => todo.id === id);
        if (!current) return;
        const next = withTodoStatus(todosRef.current, id, nextStatus(current.status));
        todosRef.current = next;
        const status = next.find((todo) => todo.id === id)?.status;
        if (status) void todoRemote.patch(id, { status });
        return;
      }
      setTodos((prev) => {
        const current = prev.find((todo) => todo.id === id);
        if (!current) return prev;
        return withTodoStatus(prev, id, nextStatus(current.status));
      });
    },
    [remote, setTodos, todoRemote.patch],
  );

  const addTodo = useCallback(
    (input: { title: string; category: HabitCategory; priority?: TodoPriority; schedule: RepeatSchedule }) => {
      const title = input.title.trim();
      if (!title) return;
      const todo: Todo = {
        id: crypto.randomUUID(),
        title,
        priority: input.priority ?? "medium",
        status: "todo",
        focusMinutes: 0,
        category: input.category,
      };
      setRepeat("todos", todo.id, input.schedule);
      if (remote) {
        todosRef.current = [...todosRef.current, todo];
        void todoRemote.add(todo);
        return;
      }
      setTodos((prev) => [...prev, todo]);
    },
    [remote, setTodos, todoRemote.add],
  );

  const updateTodo = useCallback(
    async (id: string, input: { title: string; category: HabitCategory }) => {
      const title = input.title.trim();
      if (!title || !todosRef.current.some((todo) => todo.id === id)) return false;
      const next = { title, category: input.category };
      if (remote) return (await todoRemote.patch(id, next)) === true;
      setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, ...next } : todo)));
      return true;
    },
    [remote, setTodos, todoRemote.patch],
  );

  const removeTodo = useCallback(
    (id: string) => {
      forgetRepeat("todos", id);
      if (remote) {
        todosRef.current = todosRef.current.filter((todo) => todo.id !== id);
        void todoRemote.remove(id);
      } else {
        setTodos((prev) => prev.filter((todo) => todo.id !== id));
      }
      updatePomodoro((prev) => (prev.linkedTodoId === id ? { ...prev, linkedTodoId: null } : prev));
    },
    [remote, setTodos, todoRemote.remove, updatePomodoro],
  );

  const reorderTodos = useCallback(
    (from: number, to: number) => {
      if (remote) {
        todoRemote.reorder(from, to);
        return;
      }
      setTodos((prev) => {
        if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        if (!moved) return prev;
        next.splice(to, 0, moved);
        return next;
      });
    },
    [remote, setTodos, todoRemote.reorder],
  );

  const toggleSidebar = useCallback(() => {
    ui.setValue((prev) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  }, [ui]);

  const setPomodoroPhase = useCallback(
    (phase: PomodoroPhase) => {
      pauseAmbient();
      updatePomodoro((prev) => {
        const durationSec = durationForPhase(phase, prev);
        if (
          prev.phase === phase &&
          !prev.running &&
          prev.remainingSec === durationSec &&
          prev.durationSec === durationSec
        ) {
          return prev;
        }
        return { ...prev, phase, durationSec, remainingSec: durationSec, running: false, endsAt: null };
      });
    },
    [updatePomodoro],
  );

  const startFocusForTodo = useCallback(
    (todoId: string) => {
      primeSessionAudio();
      playAmbient();
      const durationSec = durationForPhase("focus", pomodoroRef.current);
      const startedAt = Date.now();
      updatePomodoro((prev) => {
        if (prev.running && prev.phase === "focus" && prev.linkedTodoId === todoId) return prev;
        return {
          ...prev,
          phase: "focus",
          durationSec,
          remainingSec: durationSec,
          running: true,
          endsAt: startedAt + durationSec * 1000,
          linkedTodoId: todoId,
        };
      });
      if (remote) {
        const current = todosRef.current.find((todo) => todo.id === todoId);
        if (current?.status === "todo") {
          todosRef.current = todosRef.current.map((todo) =>
            todo.id === todoId ? { ...todo, status: "doing" } : todo,
          );
          void todoRemote.patch(todoId, { status: "doing" });
        }
      } else {
        setTodos((prev) => {
          let changed = false;
          const next = prev.map((todo) => {
            if (todo.id !== todoId || todo.status !== "todo") return todo;
            changed = true;
            return { ...todo, status: "doing" as const };
          });
          return changed ? next : prev;
        });
      }
    },
    [remote, setTodos, todoRemote.patch, updatePomodoro],
  );

  const startPausePomodoro = useCallback(() => {
    primeSessionAudio();
    if (pomodoroRef.current.running) pauseAmbient();
    else playAmbient();
    updatePomodoro((prev) => {
      if (prev.running) {
        return {
          ...prev,
          running: false,
          endsAt: null,
          remainingSec: remainingSeconds(prev, Date.now()),
        };
      }
      const remaining = prev.remainingSec > 0 ? prev.remainingSec : durationForPhase(prev.phase, prev);
      return {
        ...prev,
        running: true,
        remainingSec: remaining,
        durationSec: prev.durationSec || durationForPhase(prev.phase, prev),
        endsAt: Date.now() + remaining * 1000,
      };
    });
  }, [updatePomodoro]);

  const resetPomodoro = useCallback(() => {
    pauseAmbient();
    updatePomodoro((prev) => {
      const durationSec = durationForPhase(prev.phase, prev);
      if (!prev.running && prev.endsAt == null && prev.remainingSec === durationSec && prev.durationSec === durationSec) {
        return prev;
      }
      return { ...prev, running: false, endsAt: null, durationSec, remainingSec: durationSec };
    });
  }, [updatePomodoro]);

  const skipPomodoroPhase = useCallback(() => {
    primeSessionAudio();
    commitPhaseEnd(pomodoroRef.current, Date.now());
  }, [commitPhaseEnd]);

  const setPomodoroLengths = useCallback(
    (focusMinutes: number, breakMinutes: number) => {
      const nextFocus = clampFocusMinutes(focusMinutes);
      const nextBreak = clampBreakMinutes(breakMinutes);
      rememberTimerLengths(nextFocus, nextBreak);
      updatePomodoro((prev) => {
        const next = { ...prev, focusMinutes: nextFocus, breakMinutes: nextBreak };
        if (prev.running) return next;
        const durationSec = durationForPhase(prev.phase, next);
        const fresh = prev.remainingSec === prev.durationSec;
        return {
          ...next,
          durationSec,
          remainingSec: fresh ? durationSec : Math.min(prev.remainingSec, durationSec),
        };
      });
    },
    [updatePomodoro],
  );

  const recordStudySession = useCallback(
    (input: { todoId: string; purpose?: FocusPurpose; startedAt: number; endedAt: number }) => {
      const purpose = input.purpose ?? "study";
      const startedAt = input.startedAt;
      const endedAt = input.endedAt;
      const recorded = recordedMinutes(startedAt, endedAt);
      if (recorded <= 0 || !input.todoId || endedAt < startedAt) return;
      const session: PomodoroSession = {
        id: crypto.randomUUID(),
        phase: "focus",
        minutes: recorded,
        todoId: focusSessionTodoId(purpose, input.todoId),
        startedAt,
        completedAt: endedAt,
      };
      updatePomodoro((prev) => ({
        ...prev,
        sessions: [session, ...(prev.sessions ?? [])].slice(0, 40),
      }));
      if (remote) {
        const current = todosRef.current.find((todo) => todo.id === input.todoId);
        if (current) {
          const focusMinutes = current.focusMinutes + recorded;
          todosRef.current = todosRef.current.map((todo) => (todo.id === input.todoId ? { ...todo, focusMinutes } : todo));
          void todoRemote.patch(input.todoId, { focusMinutes });
        }
        void fetch("/api/pomodoro/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session }),
        });
      } else {
        setTodos((list) =>
          list.map((todo) => (todo.id === input.todoId ? { ...todo, focusMinutes: todo.focusMinutes + recorded } : todo)),
        );
      }
    },
    [remote, setTodos, todoRemote.patch, updatePomodoro],
  );

  const shiftFocusMinutes = useCallback(
    (changes: { todoId: string | null; delta: number }[]) => {
      const totals = new Map<string, number>();
      for (const change of changes) {
        const target = studyTargetId(change.todoId);
        if (!target || change.delta === 0) continue;
        totals.set(target, (totals.get(target) ?? 0) + change.delta);
      }
      for (const [id, delta] of totals) {
        if (delta === 0) continue;
        if (remote) {
          const current = todosRef.current.find((todo) => todo.id === id);
          if (!current) continue;
          const focusMinutes = Math.max(0, current.focusMinutes + delta);
          todosRef.current = todosRef.current.map((todo) => (todo.id === id ? { ...todo, focusMinutes } : todo));
          void todoRemote.patch(id, { focusMinutes });
        } else {
          setTodos((list) =>
            list.map((todo) => (todo.id === id ? { ...todo, focusMinutes: Math.max(0, todo.focusMinutes + delta) } : todo)),
          );
        }
      }
    },
    [remote, setTodos, todoRemote.patch],
  );

  const writeSessionLocal = useCallback(
    (session: PomodoroSession | null, id: string) => {
      updatePomodoro((prev) => {
        const rest = (prev.sessions ?? []).filter((item) => item.id !== id);
        return { ...prev, sessions: session ? [session, ...rest] : rest };
      });
      if (session) activityRemote.replaceSession(session);
      else activityRemote.removeSession(id);
    },
    [activityRemote.replaceSession, activityRemote.removeSession, updatePomodoro],
  );

  const updateStudySession = useCallback(
    async (input: { id: string; todoId: string; purpose?: FocusPurpose; startedAt: number; endedAt: number }) => {
      const previous = sessionsRef.current.find((session) => session.id === input.id);
      const purpose = input.purpose ?? "study";
      const recorded = recordedMinutes(input.startedAt, input.endedAt);
      if (!previous || !input.todoId || recorded <= 0 || input.endedAt <= input.startedAt) return false;
      const next: PomodoroSession = {
        ...previous,
        phase: "focus",
        minutes: recorded,
        todoId: focusSessionTodoId(purpose, input.todoId),
        startedAt: input.startedAt,
        completedAt: input.endedAt,
      };
      writeSessionLocal(next, previous.id);
      const focusChanges = [
        { todoId: previous.todoId, delta: -previous.minutes },
        { todoId: next.todoId, delta: recorded },
      ];
      if (!remote) {
        shiftFocusMinutes(focusChanges);
        return true;
      }
      const response = await fetch("/api/pomodoro/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: next.id,
          todoId: next.todoId,
          startedAt: input.startedAt,
          completedAt: input.endedAt,
        }),
      }).catch(() => null);
      if (response?.ok) {
        shiftFocusMinutes(focusChanges);
        return true;
      }
      writeSessionLocal(previous, previous.id);
      return false;
    },
    [remote, shiftFocusMinutes, writeSessionLocal],
  );

  const removeStudySession = useCallback(
    async (id: string) => {
      const previous = sessionsRef.current.find((session) => session.id === id);
      if (!previous) return false;
      writeSessionLocal(null, id);
      const focusChanges = [{ todoId: previous.todoId, delta: -previous.minutes }];
      if (!remote) {
        shiftFocusMinutes(focusChanges);
        return true;
      }
      const response = await fetch(`/api/pomodoro/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
        () => null,
      );
      if (response?.ok) {
        shiftFocusMinutes(focusChanges);
        return true;
      }
      writeSessionLocal(previous, id);
      return false;
    },
    [remote, shiftFocusMinutes, writeSessionLocal],
  );

  const setReflections = reflections.setValue;

  const importRoutine = useCallback(
    (backup: RitualBackup) => {
      const nextPomodoro = revivePomodoro(backup.pomodoro);
      pomodoroRef.current = nextPomodoro;
      setProfile(backup.profile);
      if (!remote) {
        setHabits(reviveHabits(backup.habits));
        setTodos(reviveTodos(backup.todos));
      }
      setPomodoro(nextPomodoro);
      setUi(backup.ui);
      if (!remote) setHistory(reviveHistory(backup.history));
      if (backup.ambient) applyAmbientSettings(backup.ambient);
      if (backup.focusAlert != null) applyFocusAlertEnabled(backup.focusAlert);
      if (backup.reflections) {
        const nextNotes = reviveReflections(backup.reflections);
        if (remote) journalRemote.replace(nextNotes);
        else setReflections(nextNotes);
      }
    },
    [journalRemote.replace, remote, setHabits, setHistory, setPomodoro, setProfile, setReflections, setTodos, setUi],
  );

  const setReflection = useCallback(
    (date: string, text: string) => {
      const nextText = text.slice(0, MAX_REFLECTION_LENGTH);
      if (remote) {
        journalRemote.save(date, nextText);
        return;
      }
      setReflections((prev) => {
        if (!nextText) {
          if (!(date in prev)) return prev;
          const next = { ...prev };
          delete next[date];
          return next;
        }
        if (prev[date] === nextText) return prev;
        return { ...prev, [date]: nextText };
      });
    },
    [journalRemote.save, remote, setReflections],
  );

  useEffect(() => {
    if (!remote || !accountUserId) {
      setPrefsReady(true);
      return;
    }
    hydrateRepeatBook();
    let cancelled = false;
    void loadAccountPreferences(accountUserId).then((prefs) => {
      if (cancelled) return;
      if (prefs) {
        applyAccountPreferences(prefs);
        if (typeof prefs.sidebarCollapsed === "boolean") {
          const collapsed = prefs.sidebarCollapsed;
          setUi((prev) => (prev.sidebarCollapsed === collapsed ? prev : { ...prev, sidebarCollapsed: collapsed }));
        }
        if (typeof prefs.focusMinutes === "number" || typeof prefs.breakMinutes === "number") {
          const focusMinutes = clampFocusMinutes(prefs.focusMinutes);
          const breakMinutes = clampBreakMinutes(prefs.breakMinutes);
          rememberTimerLengths(focusMinutes, breakMinutes);
          setPomodoro((prev) => {
            if (prev.focusMinutes === focusMinutes && prev.breakMinutes === breakMinutes) return prev;
            const next = { ...prev, focusMinutes, breakMinutes };
            if (prev.running) return next;
            const durationSec = durationForPhase(prev.phase, next);
            const fresh = prev.remainingSec === prev.durationSec;
            return {
              ...next,
              durationSec,
              remainingSec: fresh ? durationSec : Math.min(prev.remainingSec, durationSec),
            };
          });
        }
      }
      prefsApplied.current = accountUserId;
      setPrefsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [accountUserId, remote, setPomodoro, setUi]);

  useEffect(() => {
    if (!remote || !accountUserId || !prefsReady || prefsApplied.current !== accountUserId) return;
    let last = "";
    let timer = 0;
    const schedule = () => {
      if (prefsApplied.current !== accountUserId) return;
      const serialized = JSON.stringify(currentAccountPreferences(ui.value.sidebarCollapsed));
      if (serialized === last) return;
      last = serialized;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveAccountPreferences(accountUserId, currentAccountPreferences(ui.value.sidebarCollapsed));
      }, 500);
    };
    schedule();
    const unsubscribeAmbient = subscribeAmbient(schedule);
    const unsubscribeFocus = subscribeFocusAlert(schedule);
    const unsubscribeLengths = subscribeTimerLengths(schedule);
    const unsubscribeColors = subscribeTimerColors(schedule);
    const unsubscribeRepeat = subscribeRepeat(schedule);
    const unsubscribeTheme = subscribeTheme(schedule);
    return () => {
      unsubscribeAmbient();
      unsubscribeFocus();
      unsubscribeLengths();
      unsubscribeColors();
      unsubscribeRepeat();
      unsubscribeTheme();
      window.clearTimeout(timer);
    };
  }, [accountUserId, prefsReady, remote, ui.value.sidebarCollapsed]);

  useEffect(() => {
    if (!ready) return;
    const roll = () => {
      const today = seoulDateKey(Date.now());
      if (getRepeatBook().habitDay !== today) {
        setHabitDay(today);
        if (!remote) {
          setHabits((list) => {
            if (list.every((habit) => habit.completedCount === 0)) return list;
            return list.map((habit) => (habit.completedCount === 0 ? habit : { ...habit, completedCount: 0 }));
          });
        }
      }
      const todosNow = remote ? todosRef.current : null;
      const applyLocal = (list: typeof todosRef.current) => {
        let changed = false;
        const next = list.map((todo) => {
          if (todo.status === "todo") return todo;
          const doneOn = getRepeatBook().todoDoneOn[todo.id];
          if (!doneOn) {
            markTodoDone(todo.id, today);
            return todo;
          }
          if (doneOn === today) return todo;
          changed = true;
          clearTodoDone(todo.id);
          return { ...todo, status: "todo" as const };
        });
        return changed ? next : list;
      };
      if (todosNow) {
        for (const todo of todosNow) {
          if (todo.status === "todo") continue;
          const doneOn = getRepeatBook().todoDoneOn[todo.id];
          if (!doneOn) {
            markTodoDone(todo.id, today);
            continue;
          }
          if (doneOn === today) continue;
          void todoRemote.patch(todo.id, { status: "todo" }).then((saved) => {
            if (saved) clearTodoDone(todo.id);
          });
        }
      } else {
        setTodos(applyLocal);
      }
    };
    roll();
    const id = window.setInterval(roll, 30_000);
    return () => window.clearInterval(id);
  }, [ready, remote, setHabits, setTodos, todoRemote.patch]);

  useEffect(() => {
    const user = account.user;
    if (!user) return;
    const initials = [...user.name].slice(0, 2).join("") || "R";
    setProfile((prev) =>
      prev.name === user.name && prev.initials === initials && prev.role === user.email
        ? prev
        : { ...prev, name: user.name, initials, role: user.email },
    );
  }, [account.user, setProfile]);

  const [repeatTick, setRepeatTick] = useState(0);
  useEffect(() => subscribeRepeat(() => setRepeatTick((value) => value + 1)), []);
  const savedStreak = useRef<number | null>(null);
  useEffect(() => {
    if (!remote || !habitRemote.loaded || !activityRemote.loaded || activityRemote.error) return;
    const today = seoulDateKey(Date.now());
    const logs = activityRemote.logs.flatMap((log) => {
      const logDate = log.date.slice(0, 10);
      if (logDate === today) return [];
      return [{ habitId: log.habitId, logDate }];
    });
    for (const habit of habitRemote.habits) {
      const count = Math.min(habit.targetCount, Math.max(0, habit.completedCount));
      for (let index = 0; index < count; index += 1) {
        logs.push({ habitId: habit.id, logDate: today });
      }
    }
    const repeatBook = getRepeatBook();
    const streak = consecutiveStreak(
      habitRemote.habits.map((habit) => ({ id: habit.id, targetCount: habit.targetCount })),
      logs,
      today,
      (habitId, date) => occursOn(repeatBook.habits[habitId], date),
    );
    setProfile((prev) => (prev.streak === streak ? prev : { ...prev, streak }));
    const profileId = account.user?.id;
    if (!profileId || streak === habitRemote.streak || savedStreak.current === streak) return;
    savedStreak.current = streak;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.from("profiles").update({ streak, updated_at: new Date().toISOString() }).eq("id", profileId);
  }, [
    account.user?.id,
    activityRemote.error,
    activityRemote.loaded,
    activityRemote.logs,
    habitRemote.habits,
    habitRemote.loaded,
    habitRemote.streak,
    remote,
    repeatTick,
    setProfile,
  ]);

  useEffect(() => {
    if (!remote || !todoRemote.loaded) return;
    const linked = pomodoroRef.current.linkedTodoId;
    if (!linked || todoRemote.todos.some((todo) => todo.id === linked)) return;
    updatePomodoro((prev) => (prev.linkedTodoId === linked ? { ...prev, linkedTodoId: null } : prev));
  }, [remote, todoRemote.loaded, todoRemote.todos, updatePomodoro]);

  useEffect(() => {
    if (!remote || !todoRemote.loaded || sessionsApplied.current) return;
    sessionsApplied.current = true;
    const started = Date.now();
    void fetch("/api/pomodoro/sessions")
      .then(async (response) => {
        const today = seoulDateKey(Date.now());
        const focusCount = (list: PomodoroSession[]) =>
          list.filter(
            (session) =>
              session.phase === "focus" &&
              !isTrackedFocus(session.todoId) &&
              seoulDateKey(session.completedAt) === today,
          ).length;
        if (!response.ok) {
          setPomodoro((prev) => ({ ...prev, completedFocus: focusCount(prev.sessions), sessions: prev.sessions }));
          return;
        }
        const payload: unknown = await response.json();
        const raw =
          payload && typeof payload === "object" && "sessions" in payload
            ? (payload as { sessions: unknown }).sessions
            : null;
        const sessions = Array.isArray(raw) ? raw.filter(isRemoteSession) : [];
        setPomodoro((prev) => {
          const fresh = prev.sessions.filter((session) => session.completedAt >= started);
          const ids = new Set(fresh.map((session) => session.id));
          const nextSessions = [...fresh, ...sessions.filter((session) => !ids.has(session.id))].slice(0, 20);
          return { ...prev, sessions: nextSessions, completedFocus: focusCount(nextSessions) };
        });
      })
      .catch(() => undefined)
      .finally(() => setSessionsReady(true));
  }, [remote, setPomodoro, todoRemote.loaded]);

  const visiblePomodoro =
    remote && !sessionsReady ? { ...pomodoro.value, completedFocus: 0 } : pomodoro.value;
  const remainingSec = remainingSeconds(visiblePomodoro, now);
  const progress =
    visiblePomodoro.durationSec > 0
      ? Math.min(1, Math.max(0, (visiblePomodoro.durationSec - remainingSec) / visiblePomodoro.durationSec))
      : 0;

  const loggedSessions = useMemo(() => {
    const merged = new Map<string, PomodoroSession>();
    for (const session of activityRemote.sessions) merged.set(session.id, session);
    for (const session of visiblePomodoro.sessions ?? []) merged.set(session.id, session);
    return [...merged.values()];
  }, [activityRemote.sessions, visiblePomodoro.sessions]);
  sessionsRef.current = loggedSessions;

  const value = useMemo<RoutineContextValue>(
    () => ({
      ready,
      profile: profile.value,
      habits: displayedHabits,
      todos: displayedTodos,
      syncWarning: habitRemote.error ?? todoRemote.error ?? journalRemote.error ?? activityRemote.error,
      pomodoro: visiblePomodoro,
      history: displayedHistory,
      reflections: displayedReflections,
      sidebarCollapsed: ui.value.sidebarCollapsed,
      remainingSec,
      progress,
      toggleHabit,
      addHabit,
      removeHabit,
      cycleTodoStatus,
      toggleTodoDone,
      addTodo,
      updateTodo,
      removeTodo,
      reorderTodos,
      toggleSidebar,
      sessionNotice,
      setPomodoroPhase,
      startFocusForTodo,
      startPausePomodoro,
      resetPomodoro,
      skipPomodoroPhase,
      setPomodoroLengths,
      loggedSessions,
      recordStudySession,
      updateStudySession,
      removeStudySession,
      importRoutine,
      setReflection,
    }),
    [
      addHabit,
      addTodo,
      updateTodo,
      cycleTodoStatus,
      toggleTodoDone,
      removeTodo,
      reorderTodos,
      displayedHabits,
      displayedHistory,
      displayedReflections,
      displayedTodos,
      habitRemote.error,
      activityRemote.error,
      journalRemote.error,
      visiblePomodoro,
      sessionsReady,
      profile.value,
      progress,
      ready,
      remainingSec,
      removeHabit,
      importRoutine,
      setReflection,
      resetPomodoro,
      setPomodoroLengths,
      loggedSessions,
      recordStudySession,
      updateStudySession,
      removeStudySession,
      sessionNotice,
      setPomodoroPhase,
      skipPomodoroPhase,
      startFocusForTodo,
      startPausePomodoro,
      toggleHabit,
      toggleSidebar,
      todoRemote.error,
      ui.value.sidebarCollapsed,
    ],
  );

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>;
}

export function useRoutine() {
  const context = useContext(RoutineContext);
  if (!context) {
    throw new Error("useRoutine은 RoutineProvider 안에서만 사용할 수 있습니다.");
  }
  return context;
}
