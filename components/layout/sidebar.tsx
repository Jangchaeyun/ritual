"use client";

import { useAccount } from "@/components/account-provider";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarContent({
  collapsed,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const account = useAccount();

  return (
    <div className="flex h-full w-full flex-col bg-paper">
      <div className={cn("flex items-center gap-3 px-4 pt-6", collapsed ? "justify-center px-3" : "justify-between")}>
        <Link href="/" aria-label="RITUAL 홈" className="flex items-center gap-3" onClick={onClose}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-[13px] font-medium text-ink">
            R
          </span>
          {collapsed ? null : (
            <span className="min-w-0">
              <span className="block text-[13px] font-medium tracking-[0.22em] text-ink">RITUAL</span>
              <span className="mt-0.5 block text-[11px] text-muted">학습 플래너</span>
            </span>
          )}
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-card hover:text-ink"
            aria-label="메뉴 닫기"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <nav aria-label="주 메뉴" className="mt-8 flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                collapsed && "justify-center px-0",
                active ? "bg-fill text-on-fill" : "text-soft hover:bg-card/80 hover:text-ink",
              )}
            >
              <Icon className={cn("size-[18px] shrink-0", active ? "text-on-fill" : "text-muted")} />
              {collapsed ? null : <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        {collapsed ? null : (
          <p className="mb-2 px-2 text-[11px] tracking-wide text-muted">
            {account.user ? "계정에 저장됩니다" : "이 브라우저에 저장됩니다"}
          </p>
        )}
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={collapsed}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-soft transition hover:bg-card/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            {collapsed ? null : <span>사이드바 접기</span>}
          </button>
        ) : null}
      </div>
    </div>
  );
}
