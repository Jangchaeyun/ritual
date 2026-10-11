import { buildHourTimeline, formatHm, recordedMinutes, seoulHourStart, timelineMinutes } from "@/lib/hour-timeline";
import type { PomodoroSession } from "@/lib/types";

function session(partial: Partial<PomodoroSession> & Pick<PomodoroSession, "id" | "todoId" | "startedAt" | "completedAt">): PomodoroSession {
  const start = partial.startedAt ?? partial.completedAt;
  const end = partial.completedAt;
  return {
    phase: "focus",
    minutes: recordedMinutes(start, end),
    ...partial,
  };
}

function at(dateKey: string, hour: number, minute: number) {
  return seoulHourStart(dateKey, hour) + minute * 60_000;
}

const date = "2026-10-11";
const next = "2026-10-12";
const study = session({
  id: "study-1",
  todoId: "study:todo-a",
  startedAt: at(date, 9, 10),
  completedAt: at(date, 9, 48),
});
const workEarly = session({
  id: "work-1",
  todoId: "work:todo-b",
  startedAt: at(date, 9, 40),
  completedAt: at(date, 10, 20),
});
const workLater = session({
  id: "work-2",
  todoId: "work:todo-b",
  startedAt: at(date, 10, 30),
  completedAt: at(date, 10, 50),
});
const overnight = session({
  id: "work-night",
  todoId: "work:todo-c",
  startedAt: at(date, 23, 40),
  completedAt: at(next, 0, 20),
});

const workHours = buildHourTimeline({
  dateKey: date,
  now: at(date, 12, 0),
  purpose: "work",
  sessions: [study, workEarly, workLater, workEarly, overnight],
  open: null,
  titleFor: () => "업무",
});
const studyHours = buildHourTimeline({
  dateKey: date,
  now: at(date, 12, 0),
  purpose: "study",
  sessions: [study, workEarly, workLater, overnight],
  open: null,
  titleFor: () => "공부",
});

const workIds = workHours.flatMap((hour) => hour.rows.map((row) => row.key));
const studyIds = studyHours.flatMap((hour) => hour.rows.map((row) => row.key));
if (workIds.some((key) => key.startsWith("study-1"))) throw new Error("work timeline included a study record");
if (studyIds.some((key) => key.startsWith("work-"))) throw new Error("study timeline included a work record");
if (workHours.length !== 24) throw new Error("expected 24 hours");
if (workHours.filter((hour) => hour.rows.length === 0).length === 0) throw new Error("empty hours missing");

const nine = workHours[9].rows;
const ten = workHours[10].rows;
if (nine.length !== 1 || formatHm(nine[0].start) !== "09:40" || formatHm(nine[0].end ?? 0) !== "10:00") {
  throw new Error(`9시 분할이 잘못됐습니다: ${JSON.stringify(nine)}`);
}
if (ten.length !== 2) throw new Error(`10시에 두 기록이 있어야 합니다: ${ten.length}`);
const splitSum = (nine[0].minutes ?? 0) + (ten.find((row) => row.key.startsWith("work-1"))?.minutes ?? 0);
if (splitSum !== workEarly.minutes) throw new Error(`분할 합계 ${splitSum} !== ${workEarly.minutes}`);
if (timelineMinutes(workHours) !== workEarly.minutes + workLater.minutes + 20) {
  throw new Error(`하루 합계가 어긋납니다: ${timelineMinutes(workHours)}`);
}

const nextDay = buildHourTimeline({
  dateKey: next,
  now: at(next, 1, 0),
  purpose: "work",
  sessions: [overnight],
  open: null,
  titleFor: () => "업무",
});
const nightSum = (workHours[23].rows[0]?.minutes ?? 0) + (nextDay[0].rows[0]?.minutes ?? 0);
if (nightSum !== overnight.minutes) throw new Error(`자정 합계 ${nightSum} !== ${overnight.minutes}`);
if (formatHm(nextDay[0].rows[0].start) !== "00:00" || formatHm(nextDay[0].rows[0].end ?? 0) !== "00:20") {
  throw new Error("다음 날 0시 구간이 잘못됐습니다");
}

const openNow = at(date, 10, 5);
const openHours = buildHourTimeline({
  dateKey: date,
  now: openNow,
  purpose: "work",
  sessions: [],
  open: { id: "open-clock", startedAt: at(date, 9, 50), title: "진행" },
  titleFor: () => null,
});
const openRow = openHours[10].rows[0];
if (!openRow || openRow.end != null || openRow.minutes != null) throw new Error("진행 중 종료 시각을 만들면 안 됩니다");
if (formatHm(openHours[9].rows[0].end ?? 0) !== "10:00") throw new Error("진행 중 기록의 지난 시간대 종료가 잘못됐습니다");
if (openHours[9].rows[0].key === openHours[10].rows[0].key) throw new Error("같은 기록이 한 시간에 중복됐습니다");

console.log("hour timeline checks passed");
