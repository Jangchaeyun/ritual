"use client";

import { seoulHourStart, type DaySpan } from "@/lib/hour-timeline";
import { useEffect, useMemo, useRef } from "react";

const SLOTS_PER_HOUR = 6;

type SlotMark = {
  todoId: string | null;
  title: string | null;
};

function tenMinuteGrid(spans: DaySpan[], dateKey: string) {
  const dayStart = seoulHourStart(dateKey, 0);
  const slots: SlotMark[][] = Array.from({ length: 24 * SLOTS_PER_HOUR }, () => []);
  for (const span of spans) {
    const startMin = Math.max(0, (span.start - dayStart) / 60_000);
    const endMin = Math.min(24 * 60, (span.end - dayStart) / 60_000);
    if (endMin <= startMin) continue;
    const first = Math.floor(startMin / 10);
    const last = Math.min(24 * SLOTS_PER_HOUR - 1, Math.floor((endMin - 1e-6) / 10));
    for (let index = first; index <= last; index += 1) {
      const bucket = slots[index];
      if (bucket.some((mark) => mark.todoId === span.todoId && mark.title === span.title)) continue;
      bucket.push({ todoId: span.todoId, title: span.title });
    }
  }
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    slots: slots.slice(hour * SLOTS_PER_HOUR, hour * SLOTS_PER_HOUR + SLOTS_PER_HOUR),
  }));
}

export function PaintedTimeline({
  dateKey,
  todayKey,
  now,
  spans,
  colorFor,
}: {
  dateKey: string;
  todayKey: string;
  now: number | null;
  spans: DaySpan[];
  colorFor: (todoId: string | null) => string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const hourRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hours = useMemo(() => tenMinuteGrid(spans, dateKey), [dateKey, spans]);

  useEffect(() => {
    const node = scroller.current;
    if (!node || !dateKey) return;
    const focusHour =
      dateKey === todayKey && now != null
        ? new Date(now + 9 * 60 * 60 * 1000).getUTCHours()
        : (hours.find((hour) => hour.slots.some((slot) => slot.length > 0))?.hour ?? 8);
    const target = hourRefs.current[Math.max(0, focusHour - 1)];
    if (target) node.scrollTop = target.offsetTop;
  }, [dateKey, hours, now, todayKey]);

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-[0.18em] text-[#8a847c]">시간표</p>
      <div ref={scroller} className="mt-2 max-h-[32rem] overflow-y-auto rounded-xl border border-black/[0.05] bg-[#faf8f5]">
        {hours.map((hour) => (
          <div
            key={hour.hour}
            ref={(node) => {
              hourRefs.current[hour.hour] = node;
            }}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center border-t border-black/[0.04] first:border-t-0"
          >
            <span className="text-center font-mono text-[11px] tabular-nums text-[#b7b1a8]">{hour.hour}</span>
            <div className="my-1.5 mr-3 flex h-6 overflow-hidden bg-black/[0.045]">
              {hour.slots.map((slot, index) => (
                <div key={index} className="flex h-full min-w-0 flex-1">
                  {slot.length === 0 ? (
                    <div className={index > 0 ? "h-full w-full border-l border-white/70" : "h-full w-full"} />
                  ) : (
                    slot.map((mark) => (
                      <div
                        key={`${mark.todoId ?? "none"}-${mark.title ?? ""}`}
                        className="h-full min-w-0 flex-1"
                        style={{ background: colorFor(mark.todoId) }}
                        role="img"
                        aria-label={mark.title ?? "기록"}
                      />
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {spans.length === 0 ? <p className="mt-2 text-xs text-[#8a847c]">이 날짜에는 아직 칠해진 기록이 없습니다.</p> : null}
    </div>
  );
}
