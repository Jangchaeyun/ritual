"use client";

import { formatEventClock, type GoogleCalendarEvent } from "@/lib/google-calendar";
import { signIn, signOut } from "next-auth/react";
import { CalendarDays } from "lucide-react";

export type CalendarView =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "missing_config" }
  | { status: "unauthorized" }
  | { status: "not_enabled" }
  | { status: "permission" }
  | { status: "error" }
  | { status: "ready"; accountName: string | null; events: GoogleCalendarEvent[] };

function calendarReturnUrl() {
  if (typeof window === "undefined") return "/?calendar=1";
  const url = new URL(window.location.href);
  url.searchParams.set("calendar", "1");
  return `${url.pathname}${url.search}`;
}

function authFailureMessage(code: string | null) {
  if (code === "AccessDenied") return "캘린더 권한을 허용하지 않아 연결되지 않았습니다. 다시 로그인할 때 권한을 켜 주세요.";
  if (code === "Configuration") return "구글 로그인 설정이 서버와 맞지 않습니다.";
  if (code === "OAuthCallback" || code === "Callback" || code === "OAuthSignin") {
    return "구글 로그인은 끝났지만 이 앱에 연결 정보가 저장되지 않았습니다. 한 번 더 로그인해 주세요.";
  }
  if (code) return "구글 로그인에 실패했습니다. 다시 시도해 주세요.";
  return null;
}

function eventWhen(event: GoogleCalendarEvent) {
  if (event.allDay) return "종일";
  return `${formatEventClock(event.start)}–${formatEventClock(event.end)}`;
}

export function GoogleCalendarPanel({
  view,
  onReload,
  authError = null,
}: {
  view: CalendarView;
  onReload: () => void;
  authError?: string | null;
}) {
  if (view.status === "loading" || view.status === "idle") {
    return <div className="mt-4 h-40 animate-pulse rounded-xl border border-line bg-card" />;
  }

  if (view.status === "missing_config") {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-sm leading-6 text-soft">
        <p>Google 로그인에 클라이언트 정보가 아직 없어요.</p>
        <p className="mt-2 text-muted">
          Google Cloud에서 OAuth 클라이언트를 만든 뒤 `.env.local`에 `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`을
          넣고 개발 서버를 다시 시작하세요. 리디렉션 URI는 `http://localhost:3000/api/auth/callback/google`이고,
          Calendar API와 `calendar.readonly` 권한이 필요합니다.
        </p>
      </div>
    );
  }

  if (view.status === "unauthorized" || view.status === "permission") {
    const failure = authFailureMessage(authError);
    return (
      <div className="mt-4 rounded-xl border border-line bg-card px-4 py-6">
        <p className="text-sm leading-6 text-soft">
          {view.status === "permission"
            ? "캘린더 읽기 권한을 허용하지 않았습니다. 다시 로그인할 때 권한을 켜 주세요."
            : (failure ?? "Google 계정으로 로그인하면 오늘 일정을 불러옵니다.")}
        </p>
        <button
          type="button"
          onClick={() => void signIn("google", { callbackUrl: calendarReturnUrl() })}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-fill px-4 text-sm font-medium text-on-fill transition hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25"
        >
          Google로 로그인
        </button>
      </div>
    );
  }

  if (view.status === "not_enabled") {
    return (
      <div className="mt-4 rounded-xl border border-line bg-card px-4 py-6">
        <p className="text-sm leading-6 text-soft">
          구글 계정은 연결되었지만, Google Cloud에서 이 프로젝트의 Calendar API가 꺼져 있어 일정을 가져오지 못했습니다.
          API를 켠 뒤 다시 불러오세요.
        </p>
        <button
          type="button"
          onClick={onReload}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-line px-4 text-sm text-ink transition hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  if (view.status === "error") {
    return (
      <div className="mt-4 rounded-xl border border-line bg-card px-4 py-6">
        <p className="text-sm leading-6 text-soft">오늘 일정을 가져오지 못했어요.</p>
        <button
          type="button"
          onClick={onReload}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-line px-4 text-sm text-ink transition hover:border-ink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs text-muted">{view.accountName ? `${view.accountName}의 오늘` : "오늘"}</p>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: calendarReturnUrl() })}
          className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          로그아웃
        </button>
      </div>
      {view.events.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">
          오늘 구글 일정이 없습니다.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {view.events.map((event) => {
            const body = (
              <>
                <span className="w-24 shrink-0 font-mono text-[11px] text-accent/90 tabular-nums">{eventWhen(event)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{event.title}</span>
                <CalendarDays className="size-4 shrink-0 text-muted" />
              </>
            );
            const className =
              "flex items-center gap-3 rounded-xl border border-line bg-field px-3 py-2.5";
            return (
              <li key={event.id}>
                {event.href ? (
                  <a href={event.href} target="_blank" rel="noreferrer" className={className}>
                    {body}
                  </a>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
