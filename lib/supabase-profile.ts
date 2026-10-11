import { createSupabaseBrowserClient, supabaseConfigured } from "@/lib/supabase";

const PROFILE_KEY = "ritual:supabase-profile";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let signedInProfileId: string | null = null;

export function setSignedInProfileId(id: string | null) {
  signedInProfileId = id;
}

export function isProfileId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export async function ensureRemoteProfile(profileId: string, name = "") {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  const displayName = name.trim();
  const initials = [...displayName].slice(0, 2).join("");
  const { data } = await supabase.from("profiles").select("id, streak, name").eq("id", profileId).maybeSingle();
  if (data && typeof data === "object" && "streak" in data && typeof data.streak === "number") {
    if (displayName && "name" in data && data.name === "") {
      await supabase.from("profiles").update({ name: displayName, initials }).eq("id", profileId);
    }
    return data.streak;
  }
  const { error } = await supabase.from("profiles").insert({
    id: profileId,
    name: displayName,
    role: "",
    initials,
    streak: 0,
  });
  if (error && error.code !== "23505") throw error;
  return 0;
}

export function getOrCreateProfileId() {
  if (signedInProfileId) return signedInProfileId;
  if (typeof window === "undefined" || supabaseConfigured()) return null;
  try {
    const existing = window.localStorage.getItem(PROFILE_KEY);
    if (isProfileId(existing)) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(PROFILE_KEY, next);
    return next;
  } catch {
    return null;
  }
}
