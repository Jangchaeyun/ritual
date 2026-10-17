"use client";

import { useRoutine } from "@/components/routine-provider";
import { Surface } from "@/components/ui/surface";
import { rankForStreak } from "@/lib/ranks";
import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";

export function RankWidget() {
  const { profile } = useRoutine();
  const reduce = useReducedMotion();
  const rank = rankForStreak(profile.streak);
  const percent = Math.round(rank.progress * 100);

  return (
    <Surface className="h-full p-5" delay={0}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.22em] text-muted">
            <Flame className="size-3.5" />
            LEVEL {rank.level}
          </p>
          <h2 className="mt-2 text-xl font-medium tracking-[-0.03em] text-ink sm:text-2xl">{rank.title}</h2>
          <p className="mt-1 text-sm text-muted">연속 {rank.streak}일</p>
        </div>
        <p className="font-mono text-sm text-soft tabular-nums">
          {rank.nextTitle ? `${rank.xp} / ${rank.xpSpan} XP` : `${rank.xp} XP`}
        </p>
      </div>

      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-wash"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={rank.nextTitle ? rank.xpSpan : 1}
        aria-valuenow={rank.nextTitle ? rank.xp : 1}
        aria-label={
          rank.nextTitle
            ? `${rank.title}, 다음 칭호 ${rank.nextTitle}까지 경험치 ${percent}%`
            : `${rank.title}, 최고 칭호`
        }
      >
        <motion.div
          className="h-full rounded-full bg-ink"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <p className="mt-3 text-sm text-muted">
        {rank.nextTitle
          ? `다음 칭호 ${rank.nextTitle}까지 ${rank.daysToNext}일`
          : "최고 칭호를 유지하고 있어요"}
      </p>
    </Surface>
  );
}
