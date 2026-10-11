import type { HabitCategory, TodoPriority, TodoStatus } from "@/lib/types";

export const categoryColors: Record<HabitCategory, string> = {
  건강: "#7d9a84",
  학습: "#8b7ec8",
  업무: "#6f93b8",
  마음: "#c4899a",
};

export const categoryStyles: Record<HabitCategory, string> = {
  건강: "bg-[#faf8f5] text-[#1c2430] ring-1 ring-inset ring-black/[0.06]",
  학습: "bg-[#faf8f5] text-[#1c2430] ring-1 ring-inset ring-black/[0.06]",
  업무: "bg-[#faf8f5] text-[#1c2430] ring-1 ring-inset ring-black/[0.06]",
  마음: "bg-[#faf8f5] text-[#1c2430] ring-1 ring-inset ring-black/[0.06]",
};

export const priorityMeta: Record<TodoPriority, { label: string; chip: string; accent: string }> = {
  high: {
    label: "상",
    chip: "bg-[#1c2430] text-white",
    accent: "border-l-[#1c2430]",
  },
  medium: {
    label: "중",
    chip: "bg-black/[0.06] text-[#1c2430]",
    accent: "border-l-[#8a847c]",
  },
  low: {
    label: "하",
    chip: "bg-transparent text-[#8a847c] ring-1 ring-inset ring-black/[0.08]",
    accent: "border-l-black/10",
  },
};

export const statusMeta: Record<TodoStatus, { label: string; chip: string }> = {
  todo: {
    label: "대기",
    chip: "bg-[#faf8f5] text-[#6f6a64] ring-1 ring-inset ring-black/[0.06]",
  },
  doing: {
    label: "진행",
    chip: "bg-[#1c2430] text-white",
  },
  done: {
    label: "완료",
    chip: "bg-white text-[#1c2430] ring-1 ring-inset ring-black/[0.08]",
  },
};
