"use client";

import { seoulDateKey } from "@/lib/analytics";
import { WEEKDAY_LABELS, defaultSchedule, repeatLabel, weekdayOf, type RepeatSchedule } from "@/lib/repeat";
import { cn } from "@/lib/cn";
import { useId, useState } from "react";

export function RepeatFields({
  value,
  onChange,
}: {
  value: RepeatSchedule;
  onChange: (next: RepeatSchedule) => void;
}) {
  const untilId = useId();
  const daily = value.weekdays.length === 7;

  function toggleDay(day: number) {
    const has = value.weekdays.includes(day);
    const weekdays = has ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day].sort((left, right) => left - right);
    onChange({ ...value, weekdays: weekdays.length > 0 ? weekdays : [day] });
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted" id={`${untilId}-days`}>
            반복 요일
          </p>
          <button
            type="button"
            aria-pressed={daily}
            onClick={() =>
              onChange({
                ...value,
                weekdays: daily ? [weekdayOf(seoulDateKey(Date.now()))] : defaultSchedule().weekdays,
              })
            }
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
              daily ? "bg-fill text-on-fill" : "bg-card text-soft ring-1 ring-line",
            )}
          >
            매일
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1" role="group" aria-labelledby={`${untilId}-days`}>
          {WEEKDAY_LABELS.map((label, day) => {
            const selected = value.weekdays.includes(day);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleDay(day)}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                  selected ? "bg-fill text-on-fill" : "bg-field text-muted ring-1 ring-line",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="block text-xs text-muted" htmlFor={untilId}>
        반복 종료
        <input
          id={untilId}
          type="date"
          value={value.until ?? ""}
          onChange={(event) => onChange({ ...value, until: event.target.value || null })}
          className="mt-1.5 h-11 w-full rounded-xl border border-line bg-field px-3 text-sm text-ink outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/15"
        />
        <span className="mt-1 block text-[11px] text-muted">비워 두면 종료일 없이 반복합니다.</span>
      </label>
    </div>
  );
}

export function RepeatMenu({
  value,
  onChange,
  label,
}: {
  value: RepeatSchedule;
  onChange: (next: RepeatSchedule) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="max-w-full truncate text-left text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        {label} · {repeatLabel(value)}
      </button>
      {open ? (
        <div id={panelId} className="mt-2 rounded-xl border border-line bg-card p-3">
          <RepeatFields value={value} onChange={onChange} />
        </div>
      ) : null}
    </div>
  );
}
