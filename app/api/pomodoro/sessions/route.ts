import { recordedMinutes } from "@/lib/hour-timeline";
import { isProfileId } from "@/lib/supabase-profile";
import { isMissingColumn } from "@/lib/supabase-error";
import { requireSupabaseUser, supabaseUserError } from "@/lib/supabase/session";
import type { PomodoroSession } from "@/lib/types";

function toSession(value: unknown): PomodoroSession | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const completedAt = typeof row.completed_at === "string" ? Date.parse(row.completed_at) : Number.NaN;
  const startedRaw = typeof row.started_at === "string" ? Date.parse(row.started_at) : Number.NaN;
  if (
    typeof row.id !== "string" ||
    (row.phase !== "focus" && row.phase !== "break") ||
    typeof row.minutes !== "number" ||
    (row.todo_id !== null && typeof row.todo_id !== "string") ||
    !Number.isFinite(completedAt)
  ) {
    return null;
  }
  return {
    id: row.id,
    phase: row.phase,
    minutes: row.minutes,
    todoId: typeof row.todo_id === "string" ? row.todo_id : null,
    startedAt: Number.isFinite(startedRaw) ? startedRaw : null,
    completedAt,
  };
}

export async function GET() {
  const { supabase, userId, status } = await requireSupabaseUser();
  if (!supabase || !userId) {
    return supabaseUserError(status === 503 ? 503 : 401);
  }

  const columns = "id, phase, minutes, todo_id, completed_at, started_at";
  const fallback = "id, phase, minutes, todo_id, completed_at";
  let data: unknown[] | null = null;
  let error: { message: string; code?: string } | null = null;
  const first = await supabase
    .from("pomodoro_sessions")
    .select(columns)
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(20);
  data = first.data;
  error = first.error;
  if (error && isMissingColumn(error, "started_at")) {
    const retry = await supabase
      .from("pomodoro_sessions")
      .select(fallback)
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(20);
    data = retry.data;
    error = retry.error;
  }
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sessions: (data ?? []).flatMap((row) => {
    const session = toSession(row);
    return session ? [session] : [];
  }) });
}

export async function POST(request: Request) {
  const { supabase, userId, status } = await requireSupabaseUser();
  if (!supabase || !userId) {
    return supabaseUserError(status === 503 ? 503 : 401);
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "invalid_body" }, { status: 400 });
  const record = body as Record<string, unknown>;
  const session = record.session;
  if (!session || typeof session !== "object") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const row = session as Record<string, unknown>;
  if (
    !isProfileId(row.id) ||
    (row.phase !== "focus" && row.phase !== "break") ||
    typeof row.minutes !== "number" ||
    !Number.isFinite(row.minutes) ||
    (row.todoId !== null && typeof row.todoId !== "string") ||
    typeof row.completedAt !== "number" ||
    !Number.isFinite(row.completedAt)
  ) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const startedAt = typeof row.startedAt === "number" && Number.isFinite(row.startedAt) ? row.startedAt : null;
  const base = {
    id: row.id,
    user_id: userId,
    phase: row.phase,
    minutes: Math.max(0, Math.round(row.minutes)),
    todo_id: typeof row.todoId === "string" ? row.todoId : null,
    completed_at: new Date(row.completedAt).toISOString(),
  };
  const payload = {
    ...base,
    ...(startedAt == null ? {} : { started_at: new Date(startedAt).toISOString() }),
  };
  const inserted = await supabase.from("pomodoro_sessions").insert(payload as typeof base);
  if (inserted.error && startedAt != null && isMissingColumn(inserted.error, "started_at")) {
    const retry = await supabase.from("pomodoro_sessions").insert(base);
    if (retry.error) return Response.json({ error: retry.error.message }, { status: 500 });
    return Response.json({ ok: true });
  }
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { supabase, userId, status } = await requireSupabaseUser();
  if (!supabase || !userId) {
    return supabaseUserError(status === 503 ? 503 : 401);
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "invalid_body" }, { status: 400 });
  const row = body as Record<string, unknown>;
  const startedAt = typeof row.startedAt === "number" && Number.isFinite(row.startedAt) ? row.startedAt : null;
  const completedAt = typeof row.completedAt === "number" && Number.isFinite(row.completedAt) ? row.completedAt : null;
  if (
    !isProfileId(row.id) ||
    startedAt == null ||
    completedAt == null ||
    completedAt <= startedAt ||
    (row.todoId !== null && typeof row.todoId !== "string")
  ) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const minutes = recordedMinutes(startedAt, completedAt);
  if (minutes <= 0) return Response.json({ error: "invalid_body" }, { status: 400 });
  const base = {
    minutes,
    todo_id: typeof row.todoId === "string" ? row.todoId : null,
    completed_at: new Date(completedAt).toISOString(),
  };
  const payload = { ...base, started_at: new Date(startedAt).toISOString() };
  const updated = await supabase
    .from("pomodoro_sessions")
    .update(payload)
    .eq("id", row.id)
    .eq("user_id", userId)
    .select("id");
  if (updated.error && isMissingColumn(updated.error, "started_at")) {
    const retry = await supabase.from("pomodoro_sessions").update(base).eq("id", row.id).eq("user_id", userId).select("id");
    if (retry.error) return Response.json({ error: retry.error.message }, { status: 500 });
    if (!retry.data?.length) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  }
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 500 });
  if (!updated.data?.length) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, userId, status } = await requireSupabaseUser();
  if (!supabase || !userId) {
    return supabaseUserError(status === 503 ? 503 : 401);
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!isProfileId(id)) return Response.json({ error: "invalid_body" }, { status: 400 });
  const deleted = await supabase.from("pomodoro_sessions").delete().eq("id", id).eq("user_id", userId).select("id");
  if (deleted.error) return Response.json({ error: deleted.error.message }, { status: 500 });
  if (!deleted.data?.length) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
