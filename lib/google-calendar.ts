import { seoulDateKey } from "@/lib/analytics";

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  href: string | null;
};

export function seoulDayRange(now = Date.now()) {
  const start = new Date(`${seoulDateKey(now)}T00:00:00+09:00`);
  return {
    timeMin: start.toISOString(),
    timeMax: new Date(start.getTime() + 86_400_000).toISOString(),
  };
}

function httpsLink(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function parseCalendarEvents(payload: unknown): GoogleCalendarEvent[] {
  if (!payload || typeof payload !== "object" || !("items" in payload) || !Array.isArray(payload.items)) {
    return [];
  }

  const events: GoogleCalendarEvent[] = [];
  for (const item of payload.items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const start = record.start;
    const end = record.end;
    if (!start || typeof start !== "object" || !end || typeof end !== "object") continue;
    const startRecord = start as Record<string, unknown>;
    const endRecord = end as Record<string, unknown>;
    const startDate = typeof startRecord.date === "string" ? startRecord.date : null;
    const startDateTime = typeof startRecord.dateTime === "string" ? startRecord.dateTime : null;
    const endDate = typeof endRecord.date === "string" ? endRecord.date : null;
    const endDateTime = typeof endRecord.dateTime === "string" ? endRecord.dateTime : null;
    const allDay = Boolean(startDate && !startDateTime);
    const startValue = startDateTime ?? startDate;
    const endValue = endDateTime ?? endDate;
    if (!startValue || !endValue || typeof record.id !== "string") continue;
    events.push({
      id: record.id,
      title: typeof record.summary === "string" && record.summary.trim() ? record.summary.trim() : "(제목 없음)",
      start: startValue,
      end: endValue,
      allDay,
      href: httpsLink(record.htmlLink),
    });
  }
  return events;
}

export function formatEventClock(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
