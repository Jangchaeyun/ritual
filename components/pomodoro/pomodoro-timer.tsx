"use client";

import { useRoutine } from "@/components/routine-provider";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/pomodoro";
import { isTrackedFocus, sessionPurpose, studyTargetId } from "@/lib/study-timer";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw, SkipForward, Timer } from "lucide-react";
import { useId } from "react";

function statusCopy(
  phase: "focus" | "break",
  running: boolean,
  remaining: number,
  duration: number,
  focusMinutes: number,
  breakMinutes: number,
) {
  if (running) return phase === "focus" ? "깊게 집중하는 중" : "짧게 회복하는 중";
  if (remaining < duration) return "일시정지됨";
  return phase === "focus" ? `${focusMinutes}분 집중을 시작할 준비` : `${breakMinutes}분 휴식을 시작할 준비`;
}

function Ring({
  progress,
  size,
  burstToken,
}: {
  progress: number;
  size: number;
  burstToken: number;
}) {
  const reduce = useReducedMotion();
  const rawId = useId().replace(/:/g, "");
  const stroke = size > 200 ? 12 : 10;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={rawId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1c2430" />
            <stop offset="100%" stopColor="#6f93b8" />
          </linearGradient>
        </defs>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(30 41 59)" strokeWidth={stroke} />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${rawId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: reduce ? 0 : 0.35 }}
        />
      </svg>
      <AnimatePresence>
        {burstToken > 0 && !reduce ? (
          <motion.span
            key={burstToken}
            className="pointer-events-none absolute inset-3 rounded-full border border-[#d9d0e8]"
            initial={{ opacity: 0.9, scale: 0.86 }}
            animate={{ opacity: 0, scale: 1.08 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function formatSessionTime(stamp: number) {
  return new Date(stamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function PomodoroTimer({ variant = "card", delay = 0 }: { variant?: "card" | "hero"; delay?: number }) {
  const {
    todos,
    pomodoro,
    remainingSec,
    progress,
    sessionNotice,
    setPomodoroPhase,
    startPausePomodoro,
    resetPomodoro,
    skipPomodoroPhase,
    setPomodoroLengths,
  } = useRoutine();
  const hero = variant === "hero";
  const focusMinutes = pomodoro.focusMinutes ?? 25;
  const breakMinutes = pomodoro.breakMinutes ?? 5;
  const percent = Math.round(progress * 100);
  const resume = !pomodoro.running && remainingSec < pomodoro.durationSec;
  const linked = todos.find((todo) => todo.id === pomodoro.linkedTodoId) ?? null;
  const notice =
    sessionNotice == null
      ? null
      : sessionNotice.finishedPhase === "focus"
        ? sessionNotice.todoTitle
          ? `${sessionNotice.todoTitle}에 ${sessionNotice.minutes}분을 기록했습니다`
          : sessionNotice.minutes > 0
            ? `집중 ${sessionNotice.minutes}분을 마쳤습니다`
            : "집중 세션을 마쳤습니다"
        : "휴식이 끝났습니다. 다음 집중을 시작하세요";

  return (
    <Surface delay={delay} className={cn("flex h-full flex-col p-5", hero && "mx-auto w-full max-w-xl")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.04] text-[#1c2430]">
            <Timer className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-medium tracking-[-0.02em] text-[#1c2430]">포모도로</h2>
            <p className="mt-0.5 text-xs text-[#8a847c]">
              {focusMinutes}분 작업 · {breakMinutes}분 휴식
            </p>
          </div>
        </div>
        <p className="rounded-full bg-black/[0.04] px-2.5 py-1 font-mono text-xs text-[#1c2430]">
          {pomodoro.completedFocus}/{pomodoro.targetFocus}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-black/[0.04] p-1" role="group" aria-label="타이머 모드">
        <button
          type="button"
          aria-pressed={pomodoro.phase === "focus"}
          onClick={() => setPomodoroPhase("focus")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
            pomodoro.phase === "focus"
              ? "bg-[#1c2430] text-white"
              : "text-[#6f6a64] hover:text-[#1c2430]",
          )}
        >
          작업 {focusMinutes}분
        </button>
        <button
          type="button"
          aria-pressed={pomodoro.phase === "break"}
          onClick={() => setPomodoroPhase("break")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
            pomodoro.phase === "break"
              ? "bg-[#1c2430] text-white"
              : "text-[#6f6a64] hover:text-[#1c2430]",
          )}
        >
          휴식 {breakMinutes}분
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-xs text-[#8a847c]">
          작업 분
          <input
            type="number"
            min={1}
            max={180}
            inputMode="numeric"
            aria-label="작업 시간(분)"
            value={focusMinutes}
            onChange={(event) => setPomodoroLengths(Number(event.target.value), breakMinutes)}
            className="mt-1 w-full rounded-xl border border-black/[0.06] bg-[#faf8f5] px-3 py-2 text-sm text-[#1c2430] outline-none ring-[#1c2430]/15 focus:ring-2"
          />
        </label>
        <label className="block text-xs text-[#8a847c]">
          휴식 분
          <input
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            aria-label="휴식 시간(분)"
            value={breakMinutes}
            onChange={(event) => setPomodoroLengths(focusMinutes, Number(event.target.value))}
            className="mt-1 w-full rounded-xl border border-black/[0.06] bg-[#faf8f5] px-3 py-2 text-sm text-[#1c2430] outline-none ring-[#1c2430]/15 focus:ring-2"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="시간 프리셋">
        {(
          [
            { focus: 25, rest: 5, label: "25/5" },
            { focus: 50, rest: 10, label: "50/10" },
            { focus: 45, rest: 15, label: "45/15" },
          ] as const
        ).map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setPomodoroLengths(preset.focus, preset.rest)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20",
              focusMinutes === preset.focus && breakMinutes === preset.rest
                ? "border-[#1c2430] bg-[#1c2430] text-white"
                : "border-black/[0.08] text-[#6f6a64] hover:border-[#1c2430]/25",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {pomodoro.running ? (
        <p className="mt-2 text-xs text-[#8a847c]">진행 중인 타이머는 그대로 두고, 바꾼 시간은 다음 구간부터 적용됩니다.</p>
      ) : null}

      <div
        className="relative mx-auto mt-6 grid place-items-center"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="포모도로 진행률"
      >
        <Ring progress={progress} size={hero ? 232 : 168} burstToken={sessionNotice?.token ?? 0} />
        <div className="absolute inset-0 grid place-items-center">
          <p
            className={cn(
              "font-mono font-semibold tracking-tight text-[#1c2430] tabular-nums",
              hero ? "text-5xl" : "text-4xl",
            )}
            aria-live="polite"
          >
            {formatClock(remainingSec)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-[#8a847c]">
        {statusCopy(pomodoro.phase, pomodoro.running, remainingSec, pomodoro.durationSec, focusMinutes, breakMinutes)}
      </p>
      <p className="mt-1 truncate text-center text-xs text-[#3d5f7a]/80">
        {linked ? `${linked.title} · 누적 ${linked.focusMinutes}분` : "연결된 작업 없음"}
      </p>
      <p className="mt-2 min-h-5 text-center text-sm text-[#3d5f7a]" aria-live="polite">
        {notice}
      </p>

      <div className="mt-4 flex items-center gap-1.5" aria-label="오늘 완료한 집중 세션">
        {Array.from({ length: pomodoro.targetFocus }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              index < pomodoro.completedFocus ? "bg-[#1c2430]" : "bg-black/[0.06]",
            )}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <button
          type="button"
          onClick={startPausePomodoro}
          className="inline-flex items-center gap-2 rounded-full bg-[#1c2430] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20"
        >
          {pomodoro.running ? <Pause className="size-4" /> : <Play className="size-4" />}
          {pomodoro.running ? "일시정지" : resume ? "이어하기" : "시작"}
        </button>
        <button
          type="button"
          onClick={resetPomodoro}
          className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-sm text-[#1c2430] transition hover:border-[#1c2430]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20"
        >
          <RotateCcw className="size-4" />
          리셋
        </button>
        <button
          type="button"
          onClick={skipPomodoroPhase}
          className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-sm text-[#1c2430] transition hover:border-[#1c2430]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20"
        >
          <SkipForward className="size-4" />
          건너뛰기
        </button>
      </div>

      {hero ? (
        <div className="mt-6 border-t border-black/[0.06] pt-4">
          <h3 className="text-sm font-semibold text-[#1c2430]">세션 기록</h3>
          {pomodoro.sessions.filter((session) => !isTrackedFocus(session.todoId)).length === 0 ? (
            <p className="mt-2 text-sm text-[#8a847c]">완료된 세션이 아직 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pomodoro.sessions
                .filter((session) => !isTrackedFocus(session.todoId))
                .slice(0, 8)
                .map((session) => {
                const targetId = studyTargetId(session.todoId) ?? session.todoId;
                const task = todos.find((todo) => todo.id === targetId);
                const purpose = sessionPurpose(session.todoId);
                const label = purpose === "study" ? "공부" : purpose === "work" ? "근무" : session.phase === "focus" ? "집중" : "휴식";
                return (
                  <li key={session.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-[#1c2430]">
                      {label}
                      {task ? ` · ${task.title}` : ""}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-[#8a847c]">
                      {session.minutes}분 · {formatSessionTime(session.completedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </Surface>
  );
}
