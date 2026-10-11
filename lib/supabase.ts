import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

let browser: SupabaseClient | null = null;

export function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(8000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

export function createSupabaseBrowserClient() {
  const env = supabaseEnv();
  if (!env) return null;
  if (!browser) {
    browser = createBrowserClient(env.url, env.key, {
      global: { fetch: supabaseFetch },
    });
  }
  return browser;
}
