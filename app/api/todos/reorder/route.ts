import { isProfileId } from "@/lib/supabase-profile";
import { requireSupabaseUser, supabaseUserError } from "@/lib/supabase/session";

export async function PATCH(request: Request) {
  const { supabase, userId, status } = await requireSupabaseUser();
  if (!supabase || !userId) {
    return supabaseUserError(status === 503 ? 503 : 401);
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "invalid_body" }, { status: 400 });
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.orders)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const orders = record.orders.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (!isProfileId(row.id) || typeof row.orderIndex !== "number" || !Number.isInteger(row.orderIndex)) return [];
    return [{ id: row.id, orderIndex: row.orderIndex }];
  });
  if (orders.length !== record.orders.length) return Response.json({ error: "invalid_body" }, { status: 400 });

  const results = await Promise.all(
    orders.map((order) =>
      supabase
        .from("todos")
        .update({ order_index: order.orderIndex })
        .eq("id", order.id)
        .eq("user_id", userId),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) return Response.json({ error: failed.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
