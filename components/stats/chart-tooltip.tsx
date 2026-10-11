"use client";

import { formatFocus, type CategoryShare, type TrendPoint } from "@/lib/analytics";
import { categoryColors } from "@/lib/labels";
import type { HabitCategory } from "@/lib/types";
import { motion } from "framer-motion";
import type { TooltipContentProps } from "recharts";

function isTrend(value: unknown): value is TrendPoint {
  return !!value && typeof value === "object" && "rate" in value && "label" in value;
}

function isShare(value: unknown): value is CategoryShare {
  return !!value && typeof value === "object" && "category" in value && "minutes" in value;
}

export function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || payload.length === 0) return null;
  const row: unknown = payload[0]?.payload;
  const title = typeof label === "string" || typeof label === "number" ? String(label) : "";

  let body: { heading: string; lines: string[]; color: string } | null = null;
  if (isTrend(row)) {
    body = {
      heading: row.label || title,
      color: "#1c2430",
      lines: [
        row.rate == null ? "기록 없음" : `달성률 ${row.rate}%`,
        `집중 ${formatFocus(row.focusMinutes)}`,
      ],
    };
  } else if (isShare(row)) {
    const category = row.category as HabitCategory;
    body = {
      heading: category,
      color: categoryColors[category],
      lines: [`${formatFocus(row.minutes)}`, `${row.percent}%`],
    };
  }
  if (!body) return null;

  return (
    <motion.div
      key={body.heading}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-xl border border-black/[0.06] bg-white px-3 py-2 shadow-lg"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-[#1c2430]">
        <span className="size-2 rounded-full" style={{ background: body.color }} />
        {body.heading}
      </p>
      {body.lines.map((line) => (
        <p key={line} className="mt-1 text-xs text-[#6f6a64]">
          {line}
        </p>
      ))}
    </motion.div>
  );
}
