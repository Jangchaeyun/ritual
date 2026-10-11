"use client";

import { AmbientPlayer } from "@/components/pomodoro/ambient-player";
import { FocusAlertSetting } from "@/components/pomodoro/focus-alert-setting";
import { PomodoroTimer } from "@/components/pomodoro/pomodoro-timer";
import { StudyTimer } from "@/components/pomodoro/study-timer";
import { PageHeader } from "@/components/layout/page-header";
import { useRoutine } from "@/components/routine-provider";

export function PomodoroView() {
  const { ready } = useRoutine();

  return (
    <div>
      <PageHeader
        kicker="FOCUS"
        title="집중"
        description="공부와 근무 시간을 할 일에 기록합니다. 포모도로는 아래에서 작업·휴식 길이를 바꿔 쓸 수 있습니다."
      />
      {ready ? (
        <>
          <StudyTimer variant="hero" />
          <details className="mx-auto mt-5 w-full max-w-xl rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_1px_rgba(28,36,48,0.04),0_16px_40px_-28px_rgba(28,36,48,0.28)]">
            <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-[#1c2430] [&::-webkit-details-marker]:hidden">
              포모도로 · 작업과 휴식 길이를 직접 정할 수 있습니다
            </summary>
            <div className="px-2 pb-2">
              <PomodoroTimer variant="hero" />
            </div>
          </details>
          <FocusAlertSetting />
          <AmbientPlayer />
        </>
      ) : (
        <div className="mx-auto h-[520px] max-w-xl animate-pulse rounded-2xl border border-black/[0.06] bg-[#f3f0ea]" />
      )}
    </div>
  );
}
