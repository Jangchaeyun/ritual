"use client";

import { Surface } from "@/components/ui/surface";
import { useRoutine } from "@/components/routine-provider";
import { buildHabitHeatmap, type HabitHeatCell } from "@/lib/heatmap";
import { useMemo, useState } from "react";

const CELL = 28;
const GAP = 6;
const LABEL_W = 28;
const HEADER_H = 18;
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

const FILLS = ["#e7e2da", "#c9c3ba", "#8f897f", "#5c574f", "#1c2430"] as const;

function fillFor(cell: HabitHeatCell) {
  if (!cell.inRange) return "transparent";
  if (cell.level == null) return "#f3f0ea";
  return FILLS[cell.level];
}

function formatCellDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 3)));
}

function cellLabel(cell: HabitHeatCell) {
  if (!cell.date) return "";
  const when = formatCellDate(cell.date);
  if (cell.rate == null) return `${when}, 기록 없음`;
  return `${when}, 달성률 ${cell.rate}% (${cell.done}/${cell.total})`;
}

function monthLabel(week: HabitHeatCell[], previous: string) {
  const firstOfMonth = week.find((cell) => cell.date.endsWith("-01"));
  const anchor = firstOfMonth ?? (previous === "" ? week.find((cell) => cell.date) : undefined);
  if (!anchor?.date) return "";
  const label = `${Number(anchor.date.slice(5, 7))}월`;
  return label === previous ? "" : label;
}

export function HabitHeatmap({
  delay = 0,
  selectedDate = null,
  onSelectDate,
}: {
  delay?: number;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}) {
  const { habits, history, reflections } = useRoutine();
  const model = useMemo(() => buildHabitHeatmap(history, habits), [habits, history]);
  const [active, setActive] = useState<HabitHeatCell | null>(null);
  const weeks = model.weeks;
  const width = LABEL_W + weeks.length * CELL + Math.max(0, weeks.length - 1) * GAP;
  const height = HEADER_H + 7 * CELL + 6 * GAP;
  let previousMonth = "";

  return (
    <Surface delay={delay} className="mb-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-[#8a847c]">WEEK</p>
          <h2 className="mt-1 text-base font-medium tracking-[-0.02em] text-[#1c2430]">주간 학습 현황</h2>
          <p className="mt-1 text-sm text-[#6f6a64]">최근 30일 달성률입니다. 진할수록 그날 습관을 더 많이 채웠습니다.</p>
        </div>
        <p className="text-xs text-[#8a847c]">
          기록 {model.recordedDays}일 · 평균 {model.averageRate}%
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="grid"
          aria-label="최근 30일 습관 달성 히트맵"
          className="block text-[#8a847c]"
        >
          {WEEKDAYS.map((label, row) =>
            row % 2 === 0 ? (
              <text key={label} x={0} y={HEADER_H + row * (CELL + GAP) + 18} fontSize={11} fill="currentColor">
                {label}
              </text>
            ) : null,
          )}
          {weeks.map((week, column) => {
            const label = monthLabel(week, previousMonth);
            if (label) previousMonth = label;
            const x = LABEL_W + column * (CELL + GAP);
            return (
              <g key={week[0]?.date || `week-${column}`}>
                {label ? (
                  <text x={x} y={12} fontSize={11} fill="currentColor">
                    {label}
                  </text>
                ) : null}
                {week.map((cell, row) => {
                  const y = HEADER_H + row * (CELL + GAP);
                  if (!cell.date) {
                    return <rect key={`pad-${column}-${row}`} x={x} y={y} width={CELL} height={CELL} fill="transparent" />;
                  }
                  const labelText = cellLabel(cell);
                  const selected = cell.date === selectedDate;
                  const today = cell.date === model.today;
                  return (
                    <rect
                      key={cell.date}
                      x={x}
                      y={y}
                      width={CELL}
                      height={CELL}
                      rx={3}
                      fill={fillFor(cell)}
                      stroke={selected || today ? "#1c2430" : cell.level == null ? "rgba(28,36,48,0.08)" : "transparent"}
                      strokeWidth={selected ? 2.5 : today ? 1.5 : 1}
                      tabIndex={0}
                      role="gridcell"
                      aria-selected={selected}
                      aria-label={labelText}
                      className="cursor-pointer outline-none focus-visible:stroke-[#1c2430]"
                      onMouseEnter={() => setActive(cell)}
                      onFocus={() => setActive(cell)}
                      onClick={() => onSelectDate?.(cell.date)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        onSelectDate?.(cell.date);
                      }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="min-h-5 text-sm text-[#6f6a64]" aria-live="polite">
          {active?.date
            ? `${cellLabel(active)}${reflections[active.date] ? ` · ${reflections[active.date]}` : ""}. 칸을 누르면 회고를 엽니다.`
            : "칸을 누르면 그날의 회고를 엽니다."}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-[#8a847c]" aria-hidden>
          <span>낮음</span>
          {FILLS.map((fill) => (
            <svg key={fill} width={CELL} height={CELL} viewBox={`0 0 ${CELL} ${CELL}`}>
              <rect width={CELL} height={CELL} rx={3} fill={fill} />
            </svg>
          ))}
          <span>높음</span>
        </div>
      </div>
    </Surface>
  );
}
