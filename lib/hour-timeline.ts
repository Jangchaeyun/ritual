import { sessionPurpose, studyTargetId, type FocusPurpose } from "@/lib/study-timer";
import type { PomodoroSession } from "@/lib/types";

export type TimelineActivity = FocusPurpose;

export type TimelineRow = {
  key: string;
  hour: number;
  activity: TimelineActivity;
  title: string | null;
  start: number;
  end: number | null;
  minutes: number | null;
};

export type TimelineHour = {
  hour: number;
  label: string;
  rows: TimelineRow[];
};

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 1초 미만은 0분입니다. 그 외에는 밀리초를 분으로 반올림하고, 최소 1분으로 올립니다. */
export function recordedMinutes(start: number, end: number) {
  const elapsed = end - start;
  if (elapsed < 1000) return 0;
  return Math.max(1, Math.round(elapsed / 60_000));
}

/**
 * 시작 시각이 없거나 끝 시각보다 늦으면, 저장된 분 길이로 시작 시각을 되돌립니다.
 * 시간표는 이 구간을 시 단위로 나누되, 색은 10분 칸이 아니라 실제 분에 맞춥니다.
 */
export function sessionInterval(session: Pick<PomodoroSession, "startedAt" | "completedAt" | "minutes">) {
  const end = session.completedAt;
  const stored = session.startedAt;
  const start =
    typeof stored === "number" && Number.isFinite(stored) && stored <= end
      ? stored
      : end - Math.max(0, session.minutes) * 60_000;
  return { start, end };
}

export function seoulHourStart(dateKey: string, hour: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1, hour - 9, 0, 0);
}

export function formatHm(ms: number) {
  const shifted = new Date(ms + SEOUL_OFFSET_MS);
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function formatSlot(hour: number) {
  const start = String(hour).padStart(2, "0");
  const end = String(hour + 1).padStart(2, "0");
  return `${start}:00~${end}:00`;
}

export function formatSpent(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}분`;
  if (rest === 0) return `${hours}시간`;
  return `${hours}시간 ${rest}분`;
}

function allocateMinutes(weights: number[], total: number) {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || weightSum <= 0) return weights.map(() => 0);
  const raw = weights.map((weight) => (total * weight) / weightSum);
  const base = raw.map((value) => Math.floor(value));
  let rest = total - base.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const item of order) {
    if (rest <= 0) break;
    base[item.index] += 1;
    rest -= 1;
  }
  return base;
}

type Span = {
  id: string;
  activity: TimelineActivity;
  title: string | null;
  start: number;
  end: number;
  open: boolean;
};

function seoulKey(ms: number) {
  const shifted = new Date(ms + SEOUL_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

function slicesForSpan(span: Span) {
  const hourMs = 60 * 60 * 1000;
  const first = Math.floor((span.start + SEOUL_OFFSET_MS) / hourMs);
  const last = Math.floor((span.end - 1 + SEOUL_OFFSET_MS) / hourMs);
  const pieces: { dateKey: string; hour: number; start: number; end: number; open: boolean }[] = [];
  for (let index = first; index <= last; index += 1) {
    const bucketStart = index * hourMs - SEOUL_OFFSET_MS;
    const bucketEnd = bucketStart + hourMs;
    const start = Math.max(span.start, bucketStart);
    const end = Math.min(span.end, bucketEnd);
    if (end <= start) continue;
    const open = span.open && end === span.end && span.end < bucketEnd;
    pieces.push({
      dateKey: seoulKey(bucketStart),
      hour: new Date(bucketStart + SEOUL_OFFSET_MS).getUTCHours(),
      start,
      end: open ? span.end : end,
      open,
    });
  }
  return pieces;
}

export function buildHourTimeline(input: {
  dateKey: string;
  now: number;
  purpose: FocusPurpose;
  sessions: PomodoroSession[];
  open: { id: string; startedAt: number; title: string | null } | null;
  titleFor: (todoId: string | null) => string | null;
}): TimelineHour[] {
  const seen = new Set<string>();
  const spans: Span[] = [];
  for (const session of input.sessions) {
    if (seen.has(session.id) || sessionPurpose(session.todoId) !== input.purpose) continue;
    seen.add(session.id);
    const interval = sessionInterval(session);
    if (interval.end <= interval.start) continue;
    spans.push({
      id: session.id,
      activity: input.purpose,
      title: input.titleFor(session.todoId),
      start: interval.start,
      end: interval.end,
      open: false,
    });
  }
  if (input.open && input.open.startedAt < input.now) {
    spans.push({
      id: input.open.id,
      activity: input.purpose,
      title: input.open.title,
      start: input.open.startedAt,
      end: input.now,
      open: true,
    });
  }

  const grouped = new Map<number, TimelineRow[]>();
  for (const span of spans) {
    const pieces = slicesForSpan(span);
    const closed = pieces.filter((piece) => !piece.open);
    const minutes = span.open
      ? closed.map((piece) => recordedMinutes(piece.start, piece.end))
      : allocateMinutes(
          closed.map((piece) => piece.end - piece.start),
          recordedMinutes(span.start, span.end),
        );
    let closedIndex = 0;
    for (const piece of pieces) {
      const rowMinutes = piece.open ? null : (minutes[closedIndex++] ?? 0);
      if (piece.dateKey !== input.dateKey) continue;
      const rows = grouped.get(piece.hour) ?? [];
      rows.push({
        key: `${span.id}:${piece.dateKey}:${piece.hour}`,
        hour: piece.hour,
        activity: span.activity,
        title: span.title,
        start: piece.start,
        end: piece.open ? null : piece.end,
        minutes: rowMinutes,
      });
      grouped.set(piece.hour, rows);
    }
  }

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: formatSlot(hour),
    rows: (grouped.get(hour) ?? []).sort((left, right) => left.start - right.start),
  }));
}

export type DaySpan = {
  key: string;
  todoId: string | null;
  title: string | null;
  start: number;
  end: number;
  open: boolean;
};

export type HourPaint = {
  key: string;
  todoId: string | null;
  title: string | null;
  startRatio: number;
  endRatio: number;
  lane: number;
  laneCount: number;
};

const HOUR_MS = 60 * 60 * 1000;

export function hourPaints(spans: DaySpan[], dateKey: string, hour: number): HourPaint[] {
  const hourStart = seoulHourStart(dateKey, hour);
  const pieces = spans.flatMap((span) => {
    const start = Math.max(span.start, hourStart);
    const end = Math.min(span.end, hourStart + HOUR_MS);
    if (end <= start) return [];
    return [{
      key: span.key,
      todoId: span.todoId,
      title: span.title,
      startRatio: (start - hourStart) / HOUR_MS,
      endRatio: (end - hourStart) / HOUR_MS,
    }];
  });
  const lanes: { startRatio: number; endRatio: number }[][] = [];
  const placed = pieces.map((piece) => {
    let lane = lanes.findIndex((row) => row.every((other) => other.endRatio <= piece.startRatio || other.startRatio >= piece.endRatio));
    if (lane < 0) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push(piece);
    return { ...piece, lane };
  });
  const laneCount = Math.max(1, lanes.length);
  return placed.map((piece) => ({ ...piece, laneCount }));
}

export function buildDaySpans(input: {
  dateKey: string;
  now: number;
  purpose: FocusPurpose;
  sessions: PomodoroSession[];
  open: { id: string; startedAt: number; endedAt: number; todoId: string | null; title: string | null; running: boolean } | null;
  titleFor: (todoId: string | null) => string | null;
}): DaySpan[] {
  const dayStart = seoulHourStart(input.dateKey, 0);
  const dayEnd = seoulHourStart(input.dateKey, 24);
  const seen = new Set<string>();
  const spans: DaySpan[] = [];
  for (const session of input.sessions) {
    if (seen.has(session.id) || sessionPurpose(session.todoId) !== input.purpose) continue;
    seen.add(session.id);
    const interval = sessionInterval(session);
    const start = Math.max(interval.start, dayStart);
    const end = Math.min(interval.end, dayEnd);
    if (end <= start) continue;
    spans.push({
      key: session.id,
      todoId: studyTargetId(session.todoId),
      title: input.titleFor(session.todoId),
      start,
      end,
      open: false,
    });
  }
  if (input.open && input.open.startedAt < input.open.endedAt) {
    const start = Math.max(input.open.startedAt, dayStart);
    const end = Math.min(input.open.endedAt, dayEnd);
    if (end > start) {
      spans.push({
        key: input.open.id,
        todoId: input.open.todoId,
        title: input.open.title,
        start,
        end,
        open: input.open.running && input.open.endedAt < dayEnd && input.open.endedAt >= dayStart,
      });
    }
  }
  return spans.sort((left, right) => left.start - right.start || left.key.localeCompare(right.key));
}

export function timelineMinutes(hours: TimelineHour[]) {
  return hours.reduce(
    (sum, hour) => sum + hour.rows.reduce((inner, row) => inner + (row.minutes ?? 0), 0),
    0,
  );
}
