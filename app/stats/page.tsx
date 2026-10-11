import { StatsView } from "@/components/stats/stats-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "루틴 분석",
};

export default function StatsPage() {
  return <StatsView />;
}
