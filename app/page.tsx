import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "대시보드 · RITUAL",
  },
};

export default function HomePage() {
  return <DashboardView />;
}
