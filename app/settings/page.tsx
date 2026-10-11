import { SettingsView } from "@/components/settings/settings-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "설정",
};

export default function SettingsPage() {
  return <SettingsView />;
}
