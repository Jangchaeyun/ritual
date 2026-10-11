import { ChartColumn, LayoutDashboard, ListChecks, Settings, Timer, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/habits", label: "습관 관리", icon: ListChecks },
  { href: "/pomodoro", label: "집중", icon: Timer },
  { href: "/stats", label: "루틴 분석", icon: ChartColumn },
  { href: "/settings", label: "설정", icon: Settings },
];
