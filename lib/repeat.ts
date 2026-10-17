import { weekdayIndex, keyToUtc } from "@/lib/analytics";

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type RepeatSchedule = {
  weekdays: number[];
  until: string | null;
};

export type RepeatBook = {
  habits: Record<string, RepeatSchedule>;
  todos: Record<string, RepeatSchedule>;
  todoDoneOn: Record<string, string>;
  habitDay: string | null;
};

const STORAGE_KEY = "ritual:repeat";

export function defaultSchedule(): RepeatSchedule {
  return { weekdays: [0, 1, 2, 3, 4, 5, 6], until: null };
}

export function weekdayOf(dateKey: string) {
  return weekdayIndex(keyToUtc(dateKey));
}

function cleanWeekdays(value: unknown) {
  if (!Array.isArray(value)) return defaultSchedule().weekdays;
  const days = [...new Set(value.filter((day) => day === 0 || day === 1 || day === 2 || day === 3 || day === 4 || day === 5 || day === 6))].sort(
    (left, right) => left - right,
  );
  return days.length > 0 ? days : defaultSchedule().weekdays;
}

export function parseSchedule(value: unknown): RepeatSchedule {
  if (!value || typeof value !== "object") return defaultSchedule();
  const record = value as Record<string, unknown>;
  const until = typeof record.until === "string" && DATE_KEY.test(record.until) ? record.until : null;
  return { weekdays: cleanWeekdays(record.weekdays), until };
}

function parseMap(value: unknown, parse: (item: unknown) => RepeatSchedule | string | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, RepeatSchedule | string> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = parse(item);
    if (parsed) next[key] = parsed;
  }
  return next;
}

export function parseRepeatBook(value: unknown): RepeatBook {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const habits = parseMap(record.habits, (item) => parseSchedule(item)) as Record<string, RepeatSchedule>;
  const todos = parseMap(record.todos, (item) => parseSchedule(item)) as Record<string, RepeatSchedule>;
  const todoDoneOn = parseMap(record.todoDoneOn, (item) => (typeof item === "string" && DATE_KEY.test(item) ? item : null)) as Record<
    string,
    string
  >;
  const habitDay = typeof record.habitDay === "string" && DATE_KEY.test(record.habitDay) ? record.habitDay : null;
  return { habits, todos, todoDoneOn, habitDay };
}

/** 일정이 없으면 매일 반복으로 봅니다. `until` 다음 날과, 고르지 않은 요일은 제외합니다. 요일은 월요일이 0입니다. */
export function occursOn(schedule: RepeatSchedule | undefined, dateKey: string) {
  const rule = schedule ?? defaultSchedule();
  if (rule.until && dateKey > rule.until) return false;
  return rule.weekdays.includes(weekdayOf(dateKey));
}

export function repeatLabel(schedule: RepeatSchedule | undefined) {
  const rule = schedule ?? defaultSchedule();
  const daily = rule.weekdays.length === 7;
  const days = daily ? "매일" : rule.weekdays.map((day) => WEEKDAY_LABELS[day] ?? "").join("·");
  if (!rule.until) return days;
  const [, month, day] = rule.until.split("-");
  return `${days} · ${Number(month)}.${Number(day)}.까지`;
}

const emptyBook = (): RepeatBook => ({ habits: {}, todos: {}, todoDoneOn: {}, habitDay: null });

let book = emptyBook();
const listeners = new Set<() => void>();

function emit(next: RepeatBook) {
  book = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  for (const listener of listeners) listener();
}

export function hydrateRepeatBook() {
  if (typeof window === "undefined") return book;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) book = parseRepeatBook(JSON.parse(raw));
  } catch {
    book = emptyBook();
  }
  return book;
}

export function subscribeRepeat(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRepeatBook() {
  return book;
}

export function getRepeatServerBook() {
  return emptyBook();
}

export function exportRepeatBook() {
  return book;
}

export function replaceRepeatBook(value: unknown) {
  emit(parseRepeatBook(value));
}

export function scheduleFor(kind: "habits" | "todos", id: string) {
  return book[kind][id] ?? defaultSchedule();
}

export function setRepeat(kind: "habits" | "todos", id: string, schedule: RepeatSchedule) {
  emit({ ...book, [kind]: { ...book[kind], [id]: parseSchedule(schedule) } });
}

export function forgetRepeat(kind: "habits" | "todos", id: string) {
  if (!book[kind][id] && !book.todoDoneOn[id]) return;
  const nextKind = { ...book[kind] };
  delete nextKind[id];
  const todoDoneOn = { ...book.todoDoneOn };
  delete todoDoneOn[id];
  emit({ ...book, [kind]: nextKind, todoDoneOn });
}

export function markTodoDone(id: string, dateKey: string) {
  if (book.todoDoneOn[id] === dateKey) return;
  emit({ ...book, todoDoneOn: { ...book.todoDoneOn, [id]: dateKey } });
}

export function clearTodoDone(id: string) {
  if (!book.todoDoneOn[id]) return;
  const todoDoneOn = { ...book.todoDoneOn };
  delete todoDoneOn[id];
  emit({ ...book, todoDoneOn });
}

export function setHabitDay(dateKey: string) {
  if (book.habitDay === dateKey) return;
  emit({ ...book, habitDay: dateKey });
}
