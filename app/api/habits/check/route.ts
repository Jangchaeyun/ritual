import { seoulDateKey } from "@/lib/analytics";
import { isProfileId } from "@/lib/supabase-profile";
import { requireSupabaseUser } from "@/lib/supabase/session";
import { consecutiveStreak } from "@/lib/streak";
import { isHabitCategory } from "@/lib/types";

type HabitRow = {
  id: string;
  title: string;
  category: string;
  target_count: number;
};

type LogRow = {
  habit_id: string;
  log_date: string;
};

function isHabitRow(value: unknown): value is HabitRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.category === "string" &&
    typeof row.target_count === "number"
  );
}

export async function POST(request: Request) {
  const { supabase, userId, status } = await requireSupabaseUser();
  if (!supabase || !userId) {
    return Response.json({ error: status === 503 ? "supabase_unconfigured" : "unauthorized" }, { status });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "invalid_body" }, { status: 400 });
  const record = body as Record<string, unknown>;
  if (!isProfileId(record.habitId)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const today = seoulDateKey(Date.now());
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id, title, category, target_count")
    .eq("id", record.habitId)
    .eq("user_id", userId)
    .maybeSingle();
  if (habitError) return Response.json({ error: habitError.message }, { status: 500 });
  if (!isHabitRow(habit) || !isHabitCategory(habit.category)) {
    return Response.json({ error: "habit_not_found" }, { status: 404 });
  }

  const { count, error: countError } = await supabase
    .from("habit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("habit_id", record.habitId)
    .eq("log_date", today);
  if (countError) return Response.json({ error: countError.message }, { status: 500 });

  const completed = count ?? 0;
  if (completed >= habit.target_count) {
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("user_id", userId)
      .eq("habit_id", record.habitId)
      .eq("log_date", today);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("habit_logs").insert({
      habit_id: record.habitId,
      user_id: userId,
      log_date: today,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  const [{ data: habits, error: habitsError }, { data: logs, error: logsError }] = await Promise.all([
    supabase.from("habits").select("id, target_count").eq("user_id", userId),
    supabase.from("habit_logs").select("habit_id, log_date").eq("user_id", userId),
  ]);
  if (habitsError) return Response.json({ error: habitsError.message }, { status: 500 });
  if (logsError) return Response.json({ error: logsError.message }, { status: 500 });

  const streak = consecutiveStreak(
    (habits ?? []).flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.target_count !== "number") return [];
      return [{ id: item.id, targetCount: item.target_count }];
    }),
    ((logs ?? []) as LogRow[]).flatMap((row) =>
      row && typeof row.habit_id === "string" && typeof row.log_date === "string"
        ? [{ habitId: row.habit_id, logDate: row.log_date }]
        : [],
    ),
    today,
  );

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ streak, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });

  const { count: nextCount, error: nextCountError } = await supabase
    .from("habit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("habit_id", record.habitId)
    .eq("log_date", today);
  if (nextCountError) return Response.json({ error: nextCountError.message }, { status: 500 });

  return Response.json({ streak, habitId: record.habitId, completedCount: nextCount ?? 0 });
}
