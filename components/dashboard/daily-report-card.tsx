"use client";

import { useRoutine } from "@/components/routine-provider";
import { Surface } from "@/components/ui/surface";
import { buildDailyReportInput, type DailyReport } from "@/lib/daily-report";
import { formatFocus } from "@/lib/analytics";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const ERROR_COPY: Record<string, string> = {
  missing_key:
    "Gemini API 키가 아직 없어요. 프로젝트 루트의 .env.local에 GOOGLE_GENERATIVE_AI_API_KEY를 넣고 개발 서버를 다시 시작해 주세요.",
  invalid_key: "API 키를 확인하지 못했어요. 키를 다시 확인한 뒤 한번 더 요청해 주세요.",
  invalid_input: "오늘 기록을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.",
  unavailable: "지금 요약을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.",
};

const LINES = [
  { key: "productivity", label: "생산성" },
  { key: "strength", label: "잘한 점" },
  { key: "improvement", label: "개선점" },
] as const;

export function DailyReportCard() {
  const { habits, todos, pomodoro, history, profile } = useRoutine();
  const input = useMemo(
    () =>
      buildDailyReportInput({
        habits,
        todos,
        sessions: pomodoro.sessions,
        history,
        streak: profile.streak,
      }),
    [habits, todos, pomodoro.sessions, history, profile.streak],
  );
  const signature = JSON.stringify(input);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [reportedFor, setReportedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function createReport() {
    if (loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requested = signature;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requested,
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const code =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "unavailable";
        setError(ERROR_COPY[code] ?? ERROR_COPY.unavailable);
        return;
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("productivity" in payload) ||
        !("strength" in payload) ||
        !("improvement" in payload) ||
        typeof payload.productivity !== "string" ||
        typeof payload.strength !== "string" ||
        typeof payload.improvement !== "string"
      ) {
        setError(ERROR_COPY.unavailable);
        return;
      }
      setReport({
        productivity: payload.productivity,
        strength: payload.strength,
        improvement: payload.improvement,
      });
      setReportedFor(requested);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (!controller.signal.aborted) setError(ERROR_COPY.unavailable);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const stale = report !== null && reportedFor !== signature;

  return (
    <Surface className="mb-5 p-5" delay={0.02}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.22em] text-[#8a847c]">
            <Sparkles className="size-3.5" />
            AI REPORT
          </p>
          <h2 className="mt-2 text-lg font-medium tracking-[-0.02em] text-[#1c2430]">오늘의 리포트</h2>
          <p className="mt-1 text-sm text-[#8a847c]">
            달성 {input.completedHabits.length}개 · 집중 {formatFocus(input.focusMinutes)} · 세션{" "}
            {input.focusSessions}회
          </p>
        </div>
        <button
          type="button"
          onClick={createReport}
          disabled={loading}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#1c2430] px-4 text-sm font-medium text-white transition hover:bg-[#2a3342] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? "요약하는 중" : report ? "다시 만들기" : "리포트 만들기"}
        </button>
      </div>

      {input.completedHabits.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {input.completedHabits.map((habit, index) => (
            <li
              key={`${habit.category}-${habit.title}-${index}`}
              className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-xs text-[#1c2430]"
            >
              {habit.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[#8a847c]">오늘 목표를 채운 습관은 아직 없어요.</p>
      )}

      <div className="mt-4" aria-live="polite">
        {report ? (
          <ol className="space-y-3">
            {LINES.map((line, index) => (
              <li key={line.key} className="flex gap-3">
                <span className="mt-0.5 font-mono text-xs text-[#6f8f78]">{index + 1}</span>
                <p className="min-w-0 text-sm leading-6 text-[#1c2430]">
                  <span className="mr-2 text-[#8a847c]">{line.label}</span>
                  {report[line.key]}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm leading-6 text-[#8a847c]">
            오늘 달성한 습관과 집중 시간을 바탕으로, 생산성과 잘한 점, 개선점을 세 줄로 정리해 드려요.
          </p>
        )}
        {stale ? <p className="mt-3 text-xs text-[#3d5f7a]/80">기록이 바뀌었어요. 다시 만들면 최신 하루가 반영됩니다.</p> : null}
        {error ? <p className="mt-3 text-sm leading-6 text-[#9a4d55]">{error}</p> : null}
      </div>
    </Surface>
  );
}
