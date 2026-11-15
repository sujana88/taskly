-- Tasks: a finished task can be archived by hand, so it leaves the board, list and calendar
-- but stays in reports and timesheets. Restoring sets archived_at back to null.
alter table public.tasks
  add column archived_at timestamptz,
  add constraint tasks_archived_only_when_done check (archived_at is null or status = 'done');

comment on column public.tasks.archived_at is 'When the user archived this finished task; null = not archived. Only done tasks can be archived.';

-- Keeps completed_at and archived_at in step with status, whatever the client sends:
-- a task that leaves "done" is no longer completed, and no longer archived.
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
  else
    new.completed_at := null;
    new.archived_at := null;
  end if;
  return new;
end;
$$;

drop trigger tasks_completed_at on public.tasks;
create trigger tasks_completed_at before insert or update of status, completed_at, archived_at on public.tasks
  for each row execute function private.sync_task_completed_at();

-- The Archive view lists a user's archived tasks, newest first.
create index tasks_user_archived_idx on public.tasks (user_id, archived_at) where archived_at is not null;
