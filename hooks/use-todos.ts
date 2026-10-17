"use client";

import { useAccount } from "@/components/account-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ensureRemoteProfile, getOrCreateProfileId } from "@/lib/supabase-profile";
import {
  TODO_PRIORITIES,
  TODO_STATUSES,
  isHabitCategory,
  type Todo,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

type TodoPatch = Partial<Pick<Todo, "status" | "focusMinutes" | "title" | "category" | "priority">>;

function isTodoRow(value: unknown): value is {
  id: string;
  title: string;
  priority: string;
  status: string;
  focus_minutes: number;
  category: string;
  order_index: number;
} {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.priority === "string" &&
    typeof row.status === "string" &&
    typeof row.focus_minutes === "number" &&
    typeof row.category === "string" &&
    typeof row.order_index === "number"
  );
}

function moveTodos(todos: Todo[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= todos.length || to >= todos.length) return todos;
  const next = [...todos];
  const [moved] = next.splice(from, 1);
  if (!moved) return todos;
  next.splice(to, 0, moved);
  return next;
}

export function useTodos() {
  const account = useAccount();
  const enabled = Boolean(account.user);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(!enabled);
  const [error, setError] = useState<string | null>(null);
  const todosRef = useRef(todos);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoaded(true);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const profileId = getOrCreateProfileId();
    if (!supabase || !profileId) {
      setError("Supabase 설정을 읽지 못했습니다.");
      setLoaded(true);
      return;
    }
    await ensureRemoteProfile(profileId);
    const { data, error: todoError } = await supabase
      .from("todos")
      .select("id, title, priority, status, focus_minutes, category, order_index")
      .eq("user_id", profileId)
      .order("order_index");
    if (todoError) {
      setError(todoError.message);
      setLoaded(true);
      return;
    }
    const next = (data ?? []).flatMap((row) => {
      if (!isTodoRow(row) || !isHabitCategory(row.category)) return [];
      const priority = TODO_PRIORITIES.find((item) => item === row.priority);
      const status = TODO_STATUSES.find((item) => item === row.status);
      if (!priority || !status) return [];
      return [
        {
          id: row.id,
          title: row.title,
          priority,
          status,
          focusMinutes: Math.max(0, Math.round(row.focus_minutes)),
          category: row.category,
        },
      ];
    });
    todosRef.current = next;
    setTodos(next);
    setError(null);
    setLoaded(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      todosRef.current = [];
      setTodos([]);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    void reload().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "할 일을 불러오지 못했습니다.");
      setLoaded(true);
    });
  }, [enabled, reload]);

  const replace = useCallback((next: Todo[]) => {
    todosRef.current = next;
    setTodos(next);
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    const profileId = getOrCreateProfileId();
    const snapshot = todosRef.current;
    const next = moveTodos(snapshot, from, to);
    if (next === snapshot || !profileId) return;
    replace(next);
    setError(null);
    void fetch("/api/todos/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders: next.map((todo, index) => ({ id: todo.id, orderIndex: index })),
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("reorder_failed");
      })
      .catch(() => {
        replace(snapshot);
        setError("순서를 저장하지 못해 되돌렸습니다.");
      });
  }, [replace]);

  const patch = useCallback(async (id: string, partial: TodoPatch) => {
    const supabase = createSupabaseBrowserClient();
    const profileId = getOrCreateProfileId();
    if (!supabase || !profileId) return false;
    const snapshot = todosRef.current;
    if (!snapshot.some((todo) => todo.id === id)) return false;
    const applied: TodoPatch = { ...partial };
    if (typeof applied.title === "string") {
      const title = applied.title.trim();
      if (!title) return false;
      applied.title = title;
    }
    const next = snapshot.map((todo) => (todo.id === id ? { ...todo, ...applied } : todo));
    replace(next);
    const row: Record<string, string | number> = {};
    if (applied.status) row.status = applied.status;
    if (typeof applied.focusMinutes === "number") row.focus_minutes = applied.focusMinutes;
    if (applied.title) row.title = applied.title;
    if (applied.category) row.category = applied.category;
    if (applied.priority) row.priority = applied.priority;
    const { error: updateError } = await supabase.from("todos").update(row).eq("id", id).eq("user_id", profileId);
    if (updateError) {
      replace(snapshot);
      setError("할 일을 저장하지 못했습니다.");
      return false;
    }
    return true;
  }, [replace]);

  const add = useCallback(async (todo: Todo) => {
    const supabase = createSupabaseBrowserClient();
    const profileId = getOrCreateProfileId();
    if (!supabase || !profileId) return;
    const snapshot = todosRef.current;
    const next = [...snapshot, todo];
    replace(next);
    const { error: insertError } = await supabase.from("todos").insert({
      id: todo.id,
      user_id: profileId,
      title: todo.title,
      priority: todo.priority,
      status: todo.status,
      focus_minutes: todo.focusMinutes,
      category: todo.category,
      order_index: next.length - 1,
    });
    if (insertError) {
      replace(snapshot);
      setError("할 일을 저장하지 못했습니다.");
    }
  }, [replace]);

  const remove = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const profileId = getOrCreateProfileId();
    if (!supabase || !profileId) return;
    const snapshot = todosRef.current;
    replace(snapshot.filter((todo) => todo.id !== id));
    const { error: deleteError } = await supabase.from("todos").delete().eq("id", id).eq("user_id", profileId);
    if (deleteError) {
      replace(snapshot);
      setError("할 일을 지우지 못했습니다.");
    }
  }, [replace]);

  return { enabled, loaded, todos, error, reorder, patch, add, remove };
}
