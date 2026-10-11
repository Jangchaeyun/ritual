import { ConfirmResult } from "@/components/auth/confirm-result";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "이메일 인증 · RITUAL",
  },
};

export default function ConfirmedPage() {
  return <ConfirmResult />;
}
