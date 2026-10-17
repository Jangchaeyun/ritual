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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  init?.signal?.addEventListener("abort", onAbort, { once: true });
  if (init?.signal?.aborted) controller.abort();
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    init?.signal?.removeEventListener("abort", onAbort);
  });
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
