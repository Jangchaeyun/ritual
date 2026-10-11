import { PomodoroView } from "@/components/pomodoro/pomodoro-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "집중",
};

export default function PomodoroPage() {
  return <PomodoroView />;
}
