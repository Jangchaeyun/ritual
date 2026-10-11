"use client";

import { AuthScreen } from "@/components/auth/auth-screen";
import { useAccount } from "@/components/account-provider";
import { AppShell } from "@/components/layout/app-shell";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function AppGate({ children }: { children: ReactNode }) {
  const account = useAccount();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (account.user && pathname === "/login") router.replace("/");
  }, [account.user, pathname, router]);

  if (pathname === "/auth/confirmed") return children;
  if (pathname === "/login") {
    if (account.user) return null;
    return <AuthScreen />;
  }
  if (account.configured && !account.user) return <AuthScreen />;
  return <AppShell>{children}</AppShell>;
}
