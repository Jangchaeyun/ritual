"use client";

import { useAccount } from "@/components/account-provider";
import { confirmLinkMessage } from "@/lib/auth-messages";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Check, MailWarning } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function otpType(value: string | null): EmailOtpType {
  if (
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  ) {
    return value;
  }
  return "signup";
}

export function ConfirmResult() {
  const account = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawError = params.get("error");
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    if (!code && !tokenHash) {
      setError(rawError ? confirmLinkMessage(rawError) : "인증 링크가 없습니다. 메일의 링크를 다시 열어 주세요.");
      setReady(true);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase 설정을 읽지 못했습니다.");
      setReady(true);
      return;
    }
    const pending = code
      ? supabase.auth.exchangeCodeForSession(code)
      : supabase.auth.verifyOtp({ token_hash: tokenHash ?? "", type: otpType(params.get("type")) });
    void pending.then(({ error: authError }) => {
      if (authError) setError(confirmLinkMessage(authError.message));
      else window.history.replaceState(null, "", "/auth/confirmed");
      setReady(true);
    });
  }, []);

  useEffect(() => {
    document.title = error ? "인증 실패 · RITUAL" : "이메일 인증 · RITUAL";
  }, [error]);

  if (!ready) {
    return (
      <div
        suppressHydrationWarning
        className="grid min-h-screen place-items-center bg-[#f3f0ea] text-sm text-[#8a847c]"
      >
        인증 결과를 확인하고 있습니다
      </div>
    );
  }

  const failed = Boolean(error);
  const nextLabel = failed ? (account.user ? "루틴 화면으로" : "로그인 화면으로") : "시작하기";

  return (
    <div
      className={
        failed
          ? "min-h-screen bg-[#f3f0ea] text-[#1c2430]"
          : "min-h-screen bg-[#f3f0ea] text-[#1c2430]"
      }
    >
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-12">
        <p className="text-sm font-semibold tracking-[0.22em] text-[#8a847c]">RITUAL</p>
        <div
          className={
            failed
              ? "mt-6 grid size-16 place-items-center rounded-full bg-[#c4846a] text-white"
              : "mt-6 grid size-16 place-items-center rounded-full bg-[#1c2430] text-white"
          }
        >
          {failed ? <MailWarning className="size-8" /> : <Check className="size-8" strokeWidth={2.5} />}
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          {failed ? "인증 링크를 확인하지 못했어요" : "이메일 인증이 완료되었습니다"}
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 break-keep text-[#6f6a64]">
          {failed
            ? error
            : "이 계정으로 습관, 할 일, 포모도로 기록이 저장됩니다. 아래 버튼을 누르면 루틴 화면으로 이동합니다."}
        </p>

        <ol className="mt-8 flex max-w-xl flex-col gap-3">
          <li className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/[0.06]">
            <p className="text-sm font-medium break-keep">1. 메일의 링크를 열었습니다</p>
          </li>
          <li className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/[0.06]">
            <p className="text-sm font-medium break-keep">2. {failed ? "인증은 끝나지 않았습니다" : "계정이 확인되었습니다"}</p>
          </li>
          <li className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/[0.06]">
            <p className="text-sm font-medium break-keep">
              3. {failed ? (account.user ? "루틴 화면으로 돌아갑니다" : "로그인 화면에서 다시 시도합니다") : "시작하기로 루틴을 엽니다"}
            </p>
          </li>
        </ol>

        <Link
          href="/"
          className={
            failed
              ? "mt-8 inline-flex w-fit rounded-full bg-[#f3f0ea] px-6 py-3 text-sm font-semibold text-[#1c2430]"
              : "mt-8 inline-flex w-fit rounded-full bg-[#1c2430] px-6 py-3 text-sm font-semibold text-white"
          }
        >
          {nextLabel}
        </Link>
      </div>
    </div>
  );
}
