-- Stream changes to signed-in devices so edits on one device show up on the others.
-- Realtime applies the same RLS policies, so each user only receives their own rows.
alter publication supabase_realtime add table
  public.profiles,
  public.clients,
  public.projects,
  public.tasks,
  public.subtasks,
  public.time_entries,
  public.pomodoro_state,
  public.focus_sessions;
