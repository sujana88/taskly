-- Delivered: a finished task that was handed over to the client. Like archived, it leaves the
-- board and can be restored; a task is either delivered or archived, not both.
alter table public.tasks
  add column delivered_at timestamptz,
  add constraint tasks_delivered_only_when_done check (delivered_at is null or status = 'done'),
  add constraint tasks_delivered_or_archived check (delivered_at is null or archived_at is null);
comment on column public.tasks.delivered_at is 'When the finished task was delivered to the client; null = not delivered.';

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
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

drop trigger tasks_completed_at on public.tasks;
create trigger tasks_completed_at before insert or update of status, completed_at, archived_at, cancelled_at, delivered_at on public.tasks
  for each row execute function private.sync_task_completed_at();

create index tasks_user_delivered_idx on public.tasks (user_id, delivered_at) where delivered_at is not null;
