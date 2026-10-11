import type { Habit, HistoryState, PomodoroState, Profile, ReflectionLog, Todo, UiState } from "@/lib/types";

export const FOCUS_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;

export const sampleProfile: Profile = {
  name: "김서연",
  role: "프로덕트 오퍼레이션",
  initials: "서연",
  streak: 7,
};

export const sampleHabits: Habit[] = [
  { id: "habit-water", title: "기상 후 물 500ml", category: "건강", targetCount: 2, completedCount: 2 },
  { id: "habit-deep", title: "딥워크 90분", category: "업무", targetCount: 1, completedCount: 0 },
  { id: "habit-english", title: "영어 리딩 20분", category: "학습", targetCount: 3, completedCount: 1 },
  { id: "habit-stretch", title: "어깨 스트레칭 10분", category: "건강", targetCount: 1, completedCount: 1 },
  { id: "habit-journal", title: "하루 회고 5줄", category: "마음", targetCount: 1, completedCount: 0 },
];

export const sampleTodos: Todo[] = [
  { id: "todo-roadmap", title: "Q4 로드맵 초안 마무리", priority: "high", status: "doing", focusMinutes: 25, category: "업무" },
  { id: "todo-tokens", title: "디자인 토큰 정리", priority: "high", status: "todo", focusMinutes: 0, category: "업무" },
  { id: "todo-standup", title: "스탠드업 액션 공유", priority: "medium", status: "todo", focusMinutes: 0, category: "업무" },
  { id: "todo-read", title: "독서 1챕터", priority: "low", status: "done", focusMinutes: 0, category: "학습" },
  { id: "todo-block", title: "내일 일정 타임블록", priority: "medium", status: "todo", focusMinutes: 0, category: "업무" },
];

export const samplePomodoro: PomodoroState = {
  phase: "focus",
  durationSec: FOCUS_SECONDS,
  remainingSec: FOCUS_SECONDS,
  running: false,
  endsAt: null,
  completedFocus: 1,
  targetFocus: 4,
  linkedTodoId: "todo-roadmap",
  sessions: [],
};

export const sampleUi: UiState = {
  sidebarCollapsed: false,
};

export const sampleHistory: HistoryState = {
  days: [],
  importedSessionIds: [],
};

export const sampleReflections: ReflectionLog = {};

export const STORAGE_KEYS = {
  profile: "ritual:profile",
  habits: "ritual:habits",
  todos: "ritual:todos",
  pomodoro: "ritual:pomodoro",
  ui: "ritual:ui",
  history: "ritual:history",
  reflections: "ritual:reflections",
} as const;
