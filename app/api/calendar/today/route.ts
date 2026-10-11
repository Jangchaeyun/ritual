import { googleAuthConfigured } from "@/lib/auth";
import { parseCalendarEvents, seoulDayRange } from "@/lib/google-calendar";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

function calendarDenial(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return "permission";
  const error = payload.error;
  if (!error || typeof error !== "object" || !("errors" in error) || !Array.isArray(error.errors)) return "permission";
  const first = error.errors[0];
  const reason =
    first && typeof first === "object" && "reason" in first && typeof first.reason === "string" ? first.reason : "";
  if (reason === "accessNotConfigured") return "not_enabled";
  return "permission";
}

export async function GET(request: NextRequest) {
  if (!googleAuthConfigured()) {
    return NextResponse.json({ error: "missing_config" }, { status: 503 });
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: request.nextUrl.protocol === "https:",
  });
  if (!token?.accessToken || typeof token.accessToken !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const range = seoulDayRange();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", range.timeMin);
  url.searchParams.set("timeMax", range.timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "20");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store",
  });

  if (response.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (response.status === 403) {
    const detail: unknown = await response.json().catch(() => null);
    return NextResponse.json({ error: calendarDenial(detail) }, { status: 403 });
  }
  if (!response.ok) {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  const payload: unknown = await response.json();
  const accountName = typeof token.name === "string" ? token.name : null;
  const accountEmail = typeof token.email === "string" ? token.email : null;
  return NextResponse.json({
    account: {
      name: accountName,
      email: accountEmail,
    },
    events: parseCalendarEvents(payload),
  });
}
