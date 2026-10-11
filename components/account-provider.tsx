"use client";

import { createSupabaseBrowserClient, supabaseConfigured } from "@/lib/supabase";
import { setSignedInProfileId } from "@/lib/supabase-profile";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AccountUser = {
  id: string;
  email: string;
  name: string;
};

type AccountContextValue = {
  configured: boolean;
  ready: boolean;
  user: AccountUser | null;
};

const AccountContext = createContext<AccountContextValue | null>(null);

let pauseSignedIn = false;

export function pauseSignedInSession() {
  pauseSignedIn = true;
}

export function resumeSignedInSession() {
  pauseSignedIn = false;
}

function accountName(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const meta = user.user_metadata?.name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  const email = user.email ?? "";
  const local = email.split("@")[0]?.trim();
  return local || "회원";
}

function toAccountUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AccountUser {
  return {
    id: user.id,
    email: user.email ?? "",
    name: accountName(user),
  };
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const configured = supabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<AccountUser | null>(null);
  setSignedInProfileId(user?.id ?? null);

  useEffect(() => {
    if (!configured) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    let settled = false;
    const finish = (next: AccountUser | null) => {
      if (next && pauseSignedIn) return;
      settled = true;
      setUser(next);
      setReady(true);
    };
    const timeout = window.setTimeout(() => {
      if (!settled) setReady(true);
    }, 2500);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      finish(session?.user ? toAccountUser(session.user) : null);
    });
    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) => {
        finish(sessionData.session?.user ? toAccountUser(sessionData.session.user) : null);
      })
      .catch(() => {
        if (!settled) setReady(true);
      });

    return () => {
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const value = useMemo(() => ({ configured, ready, user }), [configured, ready, user]);

  if (!ready) {
    return (
      <div
        suppressHydrationWarning
        className="grid min-h-screen place-items-center bg-[#faf8f5] text-sm text-[#8a847c]"
      >
        로그인 상태 확인 중
      </div>
    );
  }

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount는 AccountProvider 안에서만 사용할 수 있습니다.");
  return context;
}
