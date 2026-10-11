"use client";

import { ChartTooltip } from "@/components/stats/chart-tooltip";
import { PageHeader } from "@/components/layout/page-header";
import { useAccount } from "@/components/account-provider";
import { useRoutine } from "@/components/routine-provider";
import { Surface } from "@/components/ui/surface";
import { buildDashboard, formatFocus, type AnalyticsRange } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { categoryColors } from "@/lib/labels";
import { HABIT_CATEGORIES } from "@/lib/types";
import { motion } from "framer-motion";
import { Flame, Timer, TrendingUp, Zap } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function StatsView() {
  const account = useAccount();
  const { ready, habits, todos, pomodoro, history } = useRoutine();
  const [range, setRange] = useState<AnalyticsRange>("week");
  const gradientId = useId().replace(/:/g, "");
  const model = useMemo(
    () => buildDashboard(history, habits, todos, pomodoro.sessions ?? [], range),
    [habits, history, pomodoro.sessions, range, todos],
  );
  const slices = model.categories.filter((item) => item.minutes > 0);
  const periodLabel = range === "week" ? "이번 주" : "이번 달";

  return (
    <div>
      <PageHeader
        kicker="INSIGHT"
        title="루틴 분석"
        description={
          account.user
            ? "주간·월간 습관 달성률과 카테고리별 집중 시간을 계정에 쌓인 기록으로 보여 줍니다."
            : "주간·월간 습관 달성률과 카테고리별 집중 시간을 이 브라우저에 쌓인 기록으로 보여 줍니다."
        }
      />

      {ready ? (
        <>
          <div className="mb-5 flex justify-end">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.04] p-1" role="group" aria-label="분석 기간">
              <button
                type="button"
                aria-pressed={range === "week"}
                onClick={() => setRange("week")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
                  range === "week" ? "bg-[#1c2430] text-white" : "text-[#6f6a64] hover:text-[#1c2430]",
                )}
              >
                주간
              </button>
              <button
                type="button"
                aria-pressed={range === "month"}
                onClick={() => setRange("month")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/25",
                  range === "month" ? "bg-[#1c2430] text-white" : "text-[#6f6a64] hover:text-[#1c2430]",
                )}
              >
                월간
              </button>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <SummaryCard
              icon={<Flame className="size-4" />}
              label="최고 연속 달성"
              value={`${model.summary.bestStreak}일`}
              hint={`${periodLabel}에 습관을 모두 채운 날`}
            />
            <SummaryCard
              icon={<Timer className="size-4" />}
              label="총 집중 시간"
              value={formatFocus(model.summary.focusMinutes)}
              hint={`${periodLabel} 세션에서 기록된 시간`}
            />
            <SummaryCard
              icon={<TrendingUp className="size-4" />}
              label="평균 달성률"
              value={`${model.summary.averageRate}%`}
              hint="기록이 있는 날의 평균"
            />
            <SummaryCard
              icon={<Zap className="size-4" />}
              label="집중 세션"
              value={`${model.summary.sessions}회`}
              hint={`${periodLabel}에 끝낸 집중`}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
            <Surface className="p-5 xl:col-span-3">
              <h2 className="text-base font-semibold text-[#1c2430]">{range === "week" ? "주간" : "월간"} 습관 달성률</h2>
              <p className="mt-1 text-xs text-[#8a847c]">
                {range === "week" ? "월요일부터 일요일까지" : "이번 달 날짜별"} 달성률 추이
              </p>
              <p className="sr-only">
                {model.points.map((point) => `${point.label} ${point.rate == null ? "기록 없음" : `${point.rate}%`}`).join(", ")}
              </p>
              <motion.div
                className="mt-4 h-72"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45 }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={model.points} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1c2430" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#1c2430" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#8a837a", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      interval={range === "month" ? 2 : 0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 50, 100]}
                      tick={{ fill: "#8a837a", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      unit="%"
                    />
                    <Tooltip
                      content={ChartTooltip}
                      cursor={{ stroke: "#c5b8e0", strokeOpacity: 0.8 }}
                      animationDuration={180}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      name="달성률"
                      stroke="#1c2430"
                      strokeWidth={2.5}
                      fill={`url(#${gradientId})`}
                      connectNulls={false}
                      animationDuration={800}
                      animationEasing="ease-out"
                      dot={{ r: 3, fill: "#1c2430", stroke: "#ffffff", strokeWidth: 1 }}
                      activeDot={{ r: 5, fill: "#f3eef8", stroke: "#1c2430", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            </Surface>

            <Surface delay={0.08} className="p-5 xl:col-span-2">
              <h2 className="text-base font-semibold text-[#1c2430]">카테고리별 몰입 비율</h2>
              <p className="mt-1 text-xs text-[#8a847c]">건강, 학습, 업무, 마음에 들어간 집중 시간</p>
              {slices.length === 0 ? (
                <p className="mt-16 text-center text-sm text-[#8a847c]">이 기간에 기록된 집중 시간이 없습니다.</p>
              ) : (
                <motion.div
                  className="relative mt-2 h-64"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.45, delay: 0.08 }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={slices}
                        dataKey="minutes"
                        nameKey="category"
                        innerRadius="62%"
                        outerRadius="82%"
                        paddingAngle={3}
                        stroke="#ffffff"
                        strokeWidth={2}
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {slices.map((slice) => (
                          <Cell key={slice.category} fill={categoryColors[slice.category]} />
                        ))}
                      </Pie>
                      <Tooltip content={ChartTooltip} animationDuration={180} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p className="font-mono text-xl font-semibold text-[#1c2430]">{formatFocus(model.summary.focusMinutes)}</p>
                      <p className="text-[11px] text-[#8a847c]">집중 시간</p>
                    </div>
                  </div>
                </motion.div>
              )}
              <ul className="mt-2 space-y-2">
                {HABIT_CATEGORIES.map((category) => {
                  const share = model.categories.find((item) => item.category === category);
                  return (
                    <li key={category} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-[#1c2430]">
                        <span className="size-2.5 rounded-full" style={{ background: categoryColors[category] }} />
                        {category}
                      </span>
                      <span className="font-mono text-xs text-[#8a847c]">
                        {formatFocus(share?.minutes ?? 0)} · {share?.percent ?? 0}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Surface>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="h-96 animate-pulse rounded-2xl border border-black/[0.06] bg-[#f3f0ea] xl:col-span-3" />
          <div className="h-96 animate-pulse rounded-2xl border border-black/[0.06] bg-[#f3f0ea] xl:col-span-2" />
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Surface className="p-4">
      <p className="flex items-center gap-2 text-[11px] tracking-wide text-[#8a847c]">
        <span className="text-[#3d5f7a]">{icon}</span>
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold text-[#1c2430] tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[#8a847c]">{hint}</p>
    </Surface>
  );
}
