"use client";

import { hourPaints, type DaySpan } from "@/lib/hour-timeline";
import { useEffect, useMemo, useRef } from "react";

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
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, hour) => ({ hour, paints: hourPaints(spans, dateKey, hour) })),
    [dateKey, spans],
  );

  useEffect(() => {
    const node = scroller.current;
    if (!node || !dateKey) return;
    const focusHour =
      dateKey === todayKey && now != null
        ? new Date(now + 9 * 60 * 60 * 1000).getUTCHours()
        : (hours.find((hour) => hour.paints.length > 0)?.hour ?? 8);
    const target = hourRefs.current[Math.max(0, focusHour - 1)];
    if (target) node.scrollTop = target.offsetTop;
  }, [dateKey, hours, now, todayKey]);

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-[0.18em] text-muted">시간표</p>
      <div ref={scroller} className="mt-2 max-h-[32rem] overflow-y-auto rounded-xl border border-line bg-field">
        {hours.map((hour) => (
          <div
            key={hour.hour}
            ref={(node) => {
              hourRefs.current[hour.hour] = node;
            }}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center border-t border-line first:border-t-0"
          >
            <span className="text-center font-mono text-[11px] tabular-nums text-faint">{hour.hour}</span>
            <div className="relative my-1.5 mr-3 h-6 overflow-hidden bg-wash">
              {hour.paints.map((paint) => (
                <div
                  key={paint.key}
                  className="absolute"
                  style={{
                    left: `${paint.startRatio * 100}%`,
                    width: `${(paint.endRatio - paint.startRatio) * 100}%`,
                    top: `${(paint.lane / paint.laneCount) * 100}%`,
                    height: `${100 / paint.laneCount}%`,
                    background: colorFor(paint.todoId),
                  }}
                  role="img"
                  aria-label={paint.title ?? "기록"}
                />
              ))}
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="pointer-events-none absolute inset-y-0 w-px bg-grid"
                  style={{ left: `${((index + 1) * 10) / 60 * 100}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {spans.length === 0 ? <p className="mt-2 text-xs text-muted">이 날짜에는 아직 칠해진 기록이 없습니다.</p> : null}
    </div>
  );
}
