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
  const [ready, setReady] = useState(true);
  const [user, setUser] = useState<AccountUser | null>(null);
  setSignedInProfileId(user?.id ?? null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const timeout = window.setTimeout(() => {
      if (alive) setReady(true);
    }, 1500);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setReady(true);
        return () => {
          alive = false;
          window.clearTimeout(timeout);
        };
      }

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!alive || (session?.user && pauseSignedIn)) return;
        setUser(session?.user ? toAccountUser(session.user) : null);
        setReady(true);
      });

      return () => {
        alive = false;
        window.clearTimeout(timeout);
        data.subscription.unsubscribe();
      };
    } catch {
      setReady(true);
      return () => {
        alive = false;
        window.clearTimeout(timeout);
      };
    }
  }, [configured]);

  const value = useMemo(() => ({ configured, ready, user }), [configured, ready, user]);

  if (!ready) {
    return (
      <div
        suppressHydrationWarning
        className="grid min-h-screen place-items-center bg-field text-sm text-muted"
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
