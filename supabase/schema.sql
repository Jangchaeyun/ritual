-- RITUAL tables for the Supabase SQL editor.
-- Logged-in users can read and write only their own rows.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  role text not null default '',
  initials text not null default '',
  streak integer not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now(),
  preferences jsonb not null default '{}'::jsonb
);

create table if not exists public.habits (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category text not null,
  target_count integer not null check (target_count between 1 and 7),
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

create table if not exists public.todos (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  priority text not null,
  status text not null,
  focus_minutes integer not null default 0 check (focus_minutes >= 0),
  category text not null,
  order_index integer not null default 0
);

create index if not exists todos_user_order_idx on public.todos (user_id, order_index);

create table if not exists public.pomodoro_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phase text not null check (phase in ('focus', 'break')),
  minutes integer not null check (minutes >= 0),
  todo_id text,
  completed_at timestamptz not null
);

alter table public.pomodoro_sessions add column if not exists started_at timestamptz;

create table if not exists public.daily_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  journal_date date not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, journal_date)
);

alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.todos enable row level security;
alter table public.pomodoro_sessions enable row level security;
alter table public.daily_journals enable row level security;

revoke all on public.profiles from anon;
revoke all on public.habits from anon;
revoke all on public.habit_logs from anon;
revoke all on public.todos from anon;
revoke all on public.pomodoro_sessions from anon;
revoke all on public.daily_journals from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, update, delete on public.habit_logs to authenticated;
grant select, insert, update, delete on public.todos to authenticated;
grant select, insert, update, delete on public.pomodoro_sessions to authenticated;
grant select, insert, update, delete on public.daily_journals to authenticated;

drop policy if exists ritual_profiles_all on public.profiles;
drop policy if exists ritual_profiles_select on public.profiles;
drop policy if exists ritual_profiles_insert on public.profiles;
drop policy if exists ritual_profiles_update on public.profiles;
drop policy if exists ritual_habits_all on public.habits;
drop policy if exists ritual_habit_logs_all on public.habit_logs;
drop policy if exists ritual_todos_all on public.todos;
drop policy if exists ritual_pomodoro_sessions_all on public.pomodoro_sessions;

create policy ritual_profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy ritual_profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy ritual_profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists habits_select on public.habits;
drop policy if exists habits_insert on public.habits;
drop policy if exists habits_update on public.habits;
drop policy if exists habits_delete on public.habits;
create policy habits_select on public.habits for select to authenticated using (auth.uid() = user_id);
create policy habits_insert on public.habits for insert to authenticated with check (auth.uid() = user_id);
create policy habits_update on public.habits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habits_delete on public.habits for delete to authenticated using (auth.uid() = user_id);

drop policy if exists habit_logs_select on public.habit_logs;
drop policy if exists habit_logs_insert on public.habit_logs;
drop policy if exists habit_logs_update on public.habit_logs;
drop policy if exists habit_logs_delete on public.habit_logs;
create policy habit_logs_select on public.habit_logs for select to authenticated using (auth.uid() = user_id);
create policy habit_logs_insert on public.habit_logs for insert to authenticated with check (auth.uid() = user_id);
create policy habit_logs_update on public.habit_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habit_logs_delete on public.habit_logs for delete to authenticated using (auth.uid() = user_id);

drop policy if exists todos_select on public.todos;
drop policy if exists todos_insert on public.todos;
drop policy if exists todos_update on public.todos;
drop policy if exists todos_delete on public.todos;
create policy todos_select on public.todos for select to authenticated using (auth.uid() = user_id);
create policy todos_insert on public.todos for insert to authenticated with check (auth.uid() = user_id);
create policy todos_update on public.todos for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy todos_delete on public.todos for delete to authenticated using (auth.uid() = user_id);

drop policy if exists pomodoro_sessions_select on public.pomodoro_sessions;
drop policy if exists pomodoro_sessions_insert on public.pomodoro_sessions;
drop policy if exists pomodoro_sessions_update on public.pomodoro_sessions;
drop policy if exists pomodoro_sessions_delete on public.pomodoro_sessions;
create policy pomodoro_sessions_select on public.pomodoro_sessions for select to authenticated using (auth.uid() = user_id);
create policy pomodoro_sessions_insert on public.pomodoro_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy pomodoro_sessions_update on public.pomodoro_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy pomodoro_sessions_delete on public.pomodoro_sessions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists daily_journals_select on public.daily_journals;
drop policy if exists daily_journals_insert on public.daily_journals;
drop policy if exists daily_journals_update on public.daily_journals;
drop policy if exists daily_journals_delete on public.daily_journals;
create policy daily_journals_select on public.daily_journals for select to authenticated using (auth.uid() = user_id);
create policy daily_journals_insert on public.daily_journals for insert to authenticated with check (auth.uid() = user_id);
create policy daily_journals_update on public.daily_journals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy daily_journals_delete on public.daily_journals for delete to authenticated using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text := coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), '');
begin
  insert into public.profiles (id, name, initials)
  values (new.id, display_name, left(display_name, 2))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
