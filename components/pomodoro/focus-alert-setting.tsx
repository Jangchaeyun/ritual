"use client";

import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import {
  getFocusAlertServerSnapshot,
  getFocusAlertSnapshot,
  setFocusAlertEnabled,
  subscribeFocusAlert,
} from "@/lib/focus-alert";
import { Bell, BellOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function statusCopy(enabled: boolean, permission: ReturnType<typeof getFocusAlertSnapshot>["permission"]) {
  if (permission === "unsupported") return "이 브라우저는 알림을 지원하지 않습니다.";
  if (permission === "denied") return "브라우저에서 알림이 차단되어 있습니다. 사이트 설정에서 허용한 뒤 다시 켜세요.";
  if (enabled) return "허용됨. 집중이나 휴식이 끝나면 알림과 종료음이 울립니다.";
  if (permission === "granted") return "꺼져 있음. 켜면 집중이 끝날 때 알림이 옵니다.";
  return "켜면 브라우저에 알림 권한을 요청합니다.";
}

export function FocusAlertSetting() {
  const alert = useSyncExternalStore(subscribeFocusAlert, getFocusAlertSnapshot, getFocusAlertServerSnapshot);
  const blocked = alert.permission === "unsupported";

  return (
    <Surface className="mx-auto mt-5 w-full max-w-xl p-5" delay={0.04}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-field text-accent ring-1 ring-line">
            {alert.enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent">ALERT</p>
            <h2 className="mt-1 text-base font-semibold text-ink">집중 종료 알림</h2>
            <p className="mt-1 text-sm text-muted">{statusCopy(alert.enabled, alert.permission)}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={alert.enabled}
          aria-label="집중 종료 알림"
          disabled={blocked}
          onClick={() => void setFocusAlertEnabled(!alert.enabled)}
          className={cn(
            "relative mt-1 h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:cursor-not-allowed disabled:opacity-40",
            alert.enabled ? "bg-fill" : "bg-wash ring-1 ring-line",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-6 rounded-full shadow transition",
              alert.enabled ? "bg-ink" : "bg-card",
              alert.enabled ? "left-5" : "left-0.5",
            )}
          />
        </button>
      </div>
    </Surface>
  );
}
