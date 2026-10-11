import { HabitsView } from "@/components/habits/habits-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "습관 관리",
};

export default function HabitsPage() {
  return <HabitsView />;
}
