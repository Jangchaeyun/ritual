"use client";

import { useRoutine } from "@/components/routine-provider";
import { RepeatFields } from "@/components/ui/repeat-fields";
import { defaultSchedule, type RepeatSchedule } from "@/lib/repeat";
import { HABIT_CATEGORIES, MAX_HABIT_TARGET, MIN_HABIT_TARGET, type HabitCategory } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

export function HabitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addHabit } = useRoutine();
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<HabitCategory>("건강");
  const [targetCount, setTargetCount] = useState(1);
  const [schedule, setSchedule] = useState<RepeatSchedule>(defaultSchedule);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = title.trim();
    if (!next) {
      setError("습관 이름을 입력해 주세요.");
      return;
    }
    addHabit({ title: next, category, targetCount, schedule });
    setTitle("");
    setCategory("건강");
    setTargetCount(1);
    setSchedule(defaultSchedule());
    setError("");
    onClose();
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="모달 닫기"
            className="absolute inset-0 bg-paper/90 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-paper p-5 shadow-panel"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-wash" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-ink">
                  새 습관 추가
                </h2>
                <p className="mt-1 text-sm text-muted">이름, 반복 요일, 끝날 날짜, 오늘의 목표 횟수를 정해 주세요.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-wash hover:text-ink"
                aria-label="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <label className="block text-xs text-muted" htmlFor="new-habit-title">
                습관명
                <input
                  id="new-habit-title"
                  value={title}
                  autoFocus
                  maxLength={48}
                  placeholder="예: 저녁 산책 15분"
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (error) setError("");
                  }}
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-field px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-ink/40 focus:ring-2 focus:ring-ink/15"
                />
              </label>
              {error ? <p className="text-xs text-danger">{error}</p> : null}

              <label className="block text-xs text-muted" htmlFor="new-habit-category">
                카테고리
                <select
                  id="new-habit-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as HabitCategory)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-field px-3 text-sm text-ink outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/15"
                >
                  {HABIT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <RepeatFields value={schedule} onChange={setSchedule} />

              <div>
                <p className="text-xs text-muted" id="habit-target-label">
                  하루 목표 횟수
                </p>
                <div className="mt-1.5 flex items-center gap-3" role="group" aria-labelledby="habit-target-label">
                  <button
                    type="button"
                    onClick={() => setTargetCount((value) => Math.max(MIN_HABIT_TARGET, value - 1))}
                    className="grid size-11 place-items-center rounded-xl border border-line bg-field text-ink transition hover:border-line"
                    aria-label="목표 횟수 줄이기"
                  >
                    <Minus className="size-4" />
                  </button>
                  <p className="min-w-16 text-center font-mono text-2xl font-semibold text-ink tabular-nums">
                    {targetCount}
                    <span className="ml-1 text-xs font-normal text-muted">회</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setTargetCount((value) => Math.min(MAX_HABIT_TARGET, value + 1))}
                    className="grid size-11 place-items-center rounded-xl border border-line bg-field text-ink transition hover:border-line"
                    aria-label="목표 횟수 늘리기"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-ink/20"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-fill px-4 py-2 text-sm font-semibold text-on-fill transition hover:brightness-110"
                >
                  추가
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
