-- Tasks: an unfinished task can be cancelled. It leaves the board, list, calendar and dashboard,
-- and its logged time is removed (by the app) so it is never billed. Restoring sets cancelled_at
-- back to null and the task returns to its column with 0h.
alter table public.tasks
  add column cancelled_at timestamptz,
  add constraint tasks_cancelled_not_done check (cancelled_at is null or status <> 'done');

comment on column public.tasks.cancelled_at is 'When the user cancelled this unfinished task; null = not cancelled. Its time entries are removed when it is cancelled, so it is never billed.';

-- Keeps completed_at, archived_at and cancelled_at in step with status:
-- finishing a task un-cancels it; leaving "done" un-completes and un-archives it.
create or replace function private.sync_task_completed_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'done' then
    if tg_op = 'UPDATE' and old.status = 'done' then
      new.completed_at := coalesce(new.completed_at, old.completed_at);
    else
      new.completed_at := coalesce(new.completed_at, now());
    end if;
    new.cancelled_at := null;
  else
    new.completed_at := null;
    new.archived_at := null;
  end if;
  return new;
end;
$$;

drop trigger tasks_completed_at on public.tasks;
create trigger tasks_completed_at before insert or update of status, completed_at, archived_at, cancelled_at on public.tasks
  for each row execute function private.sync_task_completed_at();

-- The Cancelled view lists a user's cancelled tasks, newest first.
create index tasks_user_cancelled_idx on public.tasks (user_id, cancelled_at) where cancelled_at is not null;
