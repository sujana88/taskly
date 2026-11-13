-- Least privilege for signed-in users, and a safe way to (re)create a missing profile.
--
-- Supabase grants every privilege on new public tables to `authenticated` by default, including
-- TRUNCATE (which ignores RLS), REFERENCES and TRIGGER. Taskly only needs the four data commands.

revoke all on public.profiles, public.clients, public.projects, public.tasks, public.subtasks,
  public.time_entries, public.pomodoro_state, public.focus_sessions from authenticated;

grant select, insert, update, delete on public.clients, public.projects, public.tasks, public.subtasks,
  public.time_entries, public.focus_sessions to authenticated;

-- One row per user, created at sign-up by the on_auth_user_created trigger. No DELETE for users:
-- the row is removed together with the account (on delete cascade from auth.users).
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.pomodoro_state to authenticated;

-- Fallback if the sign-up trigger ever failed: a user may create only their own profile row.
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);
