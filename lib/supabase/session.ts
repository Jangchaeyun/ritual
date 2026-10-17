import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireSupabaseUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, userId: null as string | null, status: 503 as const };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, userId: null, status: 401 as const };
  return { supabase, userId: data.user.id, status: 200 as const };
}

export function supabaseUserError(status: 401 | 503) {
  return Response.json({ error: status === 503 ? "supabase_unconfigured" : "unauthorized" }, { status });
}
