"use client";

import { pauseSignedInSession, resumeSignedInSession } from "@/components/account-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { authErrorMessage } from "@/lib/auth-messages";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useEffect, useState, type FormEvent } from "react";

type Mode = "login" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) setError(authErrorMessage(authError, "login"));
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = mode === "signup" ? "회원가입 · RITUAL" : "로그인 · RITUAL";
    return () => {
      document.title = previous;
    };
  }, [mode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    const nextName = name.trim();
    if (!nextEmail.includes("@")) {
      setError("이메일 형식을 확인해 주세요.");
      setNotice("");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      setNotice("");
      return;
    }
    if (mode === "signup" && !nextName) {
      setError("이름을 입력해 주세요.");
      setNotice("");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase 설정을 읽지 못했습니다.");
      return;
    }
    setPending(true);
    setError("");
    setNotice("");
    if (mode === "signup") {
      pauseSignedInSession();
      try {
        const { data, error: signError } = await supabase.auth.signUp({
          email: nextEmail,
          password,
          options: {
            data: { name: nextName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signError) {
          setError(authErrorMessage(signError.message, "signup"));
          return;
        }
        if (data.session) await supabase.auth.signOut();
        const alreadyExists = Array.isArray(data.user?.identities) && data.user.identities.length === 0;
        setNotice(
          alreadyExists
            ? "이미 가입된 이메일입니다. 로그인해 주세요."
            : "가입되었습니다. 로그인해 주세요.",
        );
        setMode("login");
        setPassword("");
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "fetch failed";
        setError(authErrorMessage(message, "signup"));
      } finally {
        resumeSignedInSession();
        setPending(false);
      }
      return;
    }
    try {
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: nextEmail,
        password,
      });
      if (signError) setError(authErrorMessage(signError.message, "login"));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "fetch failed";
      setError(authErrorMessage(message, "login"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-paper px-4 py-10 text-ink">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 size-[420px] rounded-full bg-glow blur-3xl" />
        <div className="absolute right-0 bottom-0 size-[520px] rounded-full bg-glow-2 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-panel">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-wash" />
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full border border-line text-sm font-medium text-ink">
            R
          </span>
          <div>
            <h1 className="text-lg font-medium tracking-[0.18em] text-ink">RITUAL</h1>
            <p className="text-xs text-muted">계정으로 습관과 할 일을 이어서 저장합니다</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-field p-1" role="tablist" aria-label="계정">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={mode === "login" ? "rounded-lg bg-card py-2 text-sm font-medium text-ink shadow-sm" : "rounded-lg py-2 text-sm text-muted"}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={mode === "signup" ? "rounded-lg bg-card py-2 text-sm font-medium text-ink shadow-sm" : "rounded-lg py-2 text-sm text-muted"}
          >
            회원가입
          </button>
        </div>

        <form className="mt-5 flex flex-col gap-3" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <label className="flex flex-col gap-1.5 text-xs text-muted">
              이름
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink outline-none ring-ink/15 focus:ring-2"
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink outline-none ring-ink/15 focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
              className="rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink outline-none ring-ink/15 focus:ring-2"
            />
          </label>
          {error ? <p className="text-xs text-warn">{error}</p> : null}
          {notice ? <p className="text-xs text-accent">{notice}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-xl bg-fill px-4 py-2.5 text-sm font-semibold text-on-fill disabled:opacity-60"
          >
            {pending ? "처리 중" : mode === "signup" ? "회원가입" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
