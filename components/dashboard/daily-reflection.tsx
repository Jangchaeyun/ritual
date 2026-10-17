"use client";

import { useAccount } from "@/components/account-provider";
import { useRoutine } from "@/components/routine-provider";
import { Surface } from "@/components/ui/surface";
import { seoulDateKey } from "@/lib/analytics";
import { MAX_REFLECTION_LENGTH } from "@/lib/types";
import { NotebookPen } from "lucide-react";

function formatReflectionDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 3)));
}

export function DailyReflection({
  date,
  onUseToday,
  delay = 0,
}: {
  date: string | null;
  onUseToday: () => void;
  delay?: number;
}) {
  const account = useAccount();
  const { reflections, setReflection } = useRoutine();
  const today = seoulDateKey(Date.now());
  const activeDate = date ?? today;
  const isToday = activeDate === today;
  const note = reflections[activeDate] ?? "";

  return (
    <Surface delay={delay} className="p-5">
      <div id="daily-reflection" className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-wash text-ink">
            <NotebookPen className="size-4" />
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-[0.22em] text-muted">NOTE</p>
            <h2 className="mt-1 text-base font-medium tracking-[-0.02em] text-ink">
              {isToday ? "오늘의 한 줄 회고" : `${formatReflectionDate(activeDate)} 회고`}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {isToday
                ? account.user
                  ? "날짜별로 계정에 저장됩니다."
                  : "날짜별로 이 브라우저에 저장됩니다."
                : "잔디에서 고른 날짜의 회고입니다."}
            </p>
          </div>
        </div>
        {isToday ? null : (
          <button
            type="button"
            onClick={onUseToday}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-ink transition hover:border-ink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
          >
            오늘
          </button>
        )}
      </div>

      <label className="mt-4 block">
        <span className="sr-only">{isToday ? "오늘의 한 줄 회고" : `${formatReflectionDate(activeDate)} 회고`}</span>
        <input
          type="text"
          value={note}
          maxLength={MAX_REFLECTION_LENGTH}
          onChange={(event) => setReflection(activeDate, event.target.value)}
          onBlur={(event) => setReflection(activeDate, event.target.value.trim())}
          placeholder={isToday ? "오늘을 한 줄로 남겨 두세요" : "이 날짜에 남긴 회고가 없습니다"}
          className="w-full rounded-2xl border border-line bg-field px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink/40 focus:ring-2 focus:ring-ink/15"
        />
      </label>
      <p className="mt-2 text-right font-mono text-[11px] text-muted tabular-nums">
        {note.length}/{MAX_REFLECTION_LENGTH}
      </p>
    </Surface>
  );
}
