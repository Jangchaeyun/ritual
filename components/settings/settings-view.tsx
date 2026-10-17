"use client";

import { useAccount } from "@/components/account-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeChoice } from "@/components/layout/theme-toggle";
import { useRoutine } from "@/components/routine-provider";
import { Surface } from "@/components/ui/surface";
import { exportAmbientSettings } from "@/lib/ambient-audio";
import { BACKUP_VERSION, downloadRitualBackup, parseRitualBackup, type RitualBackup } from "@/lib/backup";
import { seoulDateKey } from "@/lib/analytics";
import { exportFocusAlertEnabled } from "@/lib/focus-alert";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

export function SettingsView() {
  const account = useAccount();
  const routine = useRoutine();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<RitualBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function exportData() {
    const backup: RitualBackup = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      profile: routine.profile,
      habits: routine.habits,
      todos: routine.todos,
      pomodoro: routine.pomodoro,
      ui: { sidebarCollapsed: routine.sidebarCollapsed },
      history: routine.history,
      reflections: routine.reflections,
      ambient: exportAmbientSettings(),
      focusAlert: exportFocusAlertEnabled(),
    };
    downloadRitualBackup(backup, `ritual-${seoulDateKey(Date.now())}.json`);
    setError(null);
    setPending(null);
    setMessage("백업 파일을 내려받았습니다.");
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const result = parseRitualBackup(parsed);
        if (!result.ok) {
          setPending(null);
          setMessage(null);
          setError(result.message);
          return;
        }
        setPending(result.backup);
        setError(null);
        setMessage(null);
      } catch {
        setPending(null);
        setMessage(null);
        setError("JSON 파일을 읽지 못했습니다.");
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pending) return;
    routine.importRoutine(pending);
    setPending(null);
    setError(null);
    setMessage(
      account.user
        ? "회고와 화면 설정을 계정에 반영했습니다. 습관과 할 일은 그대로입니다."
        : "백업을 복원했습니다. 이 브라우저의 데이터가 바뀌었습니다.",
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <PageHeader
        kicker="SETTINGS"
        title="설정"
        description={
          account.user
            ? "계정에 있는 습관, 할 일, 회고, 달성 기록을 JSON으로 내보냅니다. 되돌리기는 회고와 화면 설정에 적용되고, 습관과 할 일은 바꾸지 않습니다."
            : "이 브라우저에 저장된 루틴 데이터를 JSON 파일로 내보내거나, 백업 파일로 되돌립니다."
        }
      />

      <Surface className="mb-4 max-w-2xl p-5">
        <h2 className="text-base font-medium tracking-[-0.02em] text-ink">화면</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {account.user
            ? "밝은 테마와 어두운 테마 중에서 고릅니다. 이 브라우저와 계정에 저장됩니다."
            : "밝은 테마와 어두운 테마 중에서 고릅니다. 이 브라우저에 저장됩니다."}
        </p>
        <ThemeChoice />
      </Surface>

      {routine.ready ? (
        <Surface className="max-w-2xl p-5">
          <h2 className="text-base font-medium tracking-[-0.02em] text-ink">데이터 백업</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            프로필, 습관, 할 일, 포모도로, 달성 기록, 한 줄 회고, 사이드바, 배경 소리, 집중 알림 설정이 포함됩니다.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportData}
              className="inline-flex items-center gap-2 rounded-full bg-fill px-4 py-2 text-sm font-medium text-on-fill transition hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25"
            >
              <Download className="size-4" />
              JSON 내보내기
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm text-ink transition hover:border-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
            >
              <Upload className="size-4" />
              JSON 가져오기
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="백업 JSON 파일"
              onChange={(event) => {
                onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          {pending ? (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-paper p-4">
              <p className="text-sm text-warn">
                {account.user
                  ? `${pending.profile.name}의 백업에서 회고와 화면 설정을 계정에 반영합니다. 습관과 할 일은 바꾸지 않습니다.`
                  : `${pending.profile.name}의 백업으로 현재 데이터를 바꿉니다. 이 브라우저의 기존 기록은 덮어씁니다.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmImport}
                  className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-on-ink transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
                >
                  복원
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
                >
                  취소
                </button>
              </div>
            </div>
          ) : null}

          {message ? (
            <p className="mt-4 text-sm text-accent" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </Surface>
      ) : (
        <div className="h-56 max-w-2xl animate-pulse rounded-2xl border border-line bg-paper" />
      )}
    </div>
  );
}
