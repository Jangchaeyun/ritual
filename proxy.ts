import { supabaseEnv, supabaseFetch } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/habits", "/stats", "/settings", "/pomodoro"];

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "http://ritual.local");
    if (url.origin !== "http://ritual.local") return null;
    return { pathname: url.pathname, search: url.search };
  } catch {
    return null;
  }
}

function isProtectedPath(pathname: string) {
  if (pathname === "/" || pathname === "/dashboard") return true;
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = supabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.key, {
    global: { fetch: supabaseFetch },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let user: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch {
    user = null;
  }
  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    const next = `${pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
    const redirect = NextResponse.redirect(url);
    copyCookies(response, redirect);
    return redirect;
  }

  if (user && (pathname === "/login" || pathname === "/dashboard")) {
    const destination = request.nextUrl.clone();
    if (pathname === "/login") {
      const next = safeNextPath(request.nextUrl.searchParams.get("next"));
      destination.pathname = next?.pathname ?? "/";
      destination.search = next?.search ?? "";
    } else {
      destination.pathname = "/";
    }
    const redirect = NextResponse.redirect(destination);
    copyCookies(response, redirect);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
