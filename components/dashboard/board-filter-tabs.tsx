"use client";

import { BOARD_FILTERS, type BoardFilter } from "@/lib/board-filter";
import { cn } from "@/lib/cn";

export function BoardFilterTabs({
  value,
  onChange,
  label,
}: {
  value: BoardFilter;
  onChange: (next: BoardFilter) => void;
  label: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {BOARD_FILTERS.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20",
              selected
                ? "bg-[#1c2430] text-white"
                : "bg-white text-[#6f6a64] ring-1 ring-black/[0.06] hover:text-[#1c2430]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
