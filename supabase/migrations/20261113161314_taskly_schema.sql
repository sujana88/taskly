-- Taskly: per-user data with Row Level Security, Pomodoro sync across devices,
-- and a sample-data import for new accounts.
--
-- Every table carries user_id so RLS needs no joins. Composite foreign keys
-- (parent_id, user_id) make it impossible to attach a row to someone else's parent.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (private schema: not exposed through the Data API)
-- ---------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Keeps completed_at in step with status, whatever the client sends.
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
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  work_start time not null default '09:00',
  work_end time not null default '17:00',
  work_days smallint[] not null default '{1,2,3,4,5}',
  language text not null default 'en' check (language in ('en', 'id')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_hours_differ check (work_start <> work_end),
  constraint profiles_work_days_valid check (cardinality(work_days) between 1 and 7 and work_days <@ '{0,1,2,3,4,5,6}'::smallint[])
);
comment on table public.profiles is 'One row per user: display name and own working hours (in the device time zone).';

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  color text not null default '#0E7490' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  work_start time not null default '09:00',
  work_end time not null default '17:00',
  work_days smallint[] not null default '{1,2,3,4,5}',
  hourly_rate numeric(14, 2) not null default 0 check (hourly_rate >= 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (char_length(contact_email) <= 254),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_id_user_key unique (id, user_id),
  constraint clients_hours_differ check (work_start <> work_end),
  constraint clients_work_days_valid check (cardinality(work_days) between 1 and 7 and work_days <@ '{0,1,2,3,4,5,6}'::smallint[])
);
comment on column public.clients.timezone is 'IANA zone, e.g. Europe/Berlin. Working hours are in this zone.';
create index clients_user_idx on public.clients (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_id_user_key unique (id, user_id),
  constraint projects_client_fk foreign key (client_id, user_id) references public.clients (id, user_id) on delete cascade
);
create index projects_user_idx on public.projects (user_id);
create index projects_client_idx on public.projects (client_id, user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '' check (char_length(description) <= 20000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'in_revision', 'done')),
  sort_order double precision not null default 1000,
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_id_user_key unique (id, user_id),
  constraint tasks_done_has_completed_at check ((status = 'done') = (completed_at is not null)),
  constraint tasks_project_fk foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
comment on column public.tasks.sort_order is 'Manual position inside its status column; smaller comes first.';
create index tasks_project_idx on public.tasks (project_id, user_id);
create index tasks_board_idx on public.tasks (user_id, status, sort_order);
create index tasks_open_due_idx on public.tasks (user_id, due_at) where status <> 'done';

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  done boolean not null default false,
  position double precision not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subtasks_task_fk foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index subtasks_task_idx on public.subtasks (task_id, user_id, position);
create index subtasks_user_idx on public.subtasks (user_id);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null default 'timer' check (source in ('timer', 'pomodoro', 'manual')),
  billable boolean not null default true,
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  constraint time_entries_end_after_start check (ended_at is null or ended_at > started_at),
  constraint time_entries_task_fk foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
comment on column public.time_entries.ended_at is 'Null while the timer is running.';
-- Only one timer may run per user, on any device.
create unique index time_entries_one_running_idx on public.time_entries (user_id) where ended_at is null;
create index time_entries_user_started_idx on public.time_entries (user_id, started_at desc);
create index time_entries_task_idx on public.time_entries (task_id, user_id);

-- Pomodoro settings and the live timer, one row per user, so every device shows the same session.
create table public.pomodoro_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  focus_minutes smallint not null default 25 check (focus_minutes between 1 and 180),
  short_minutes smallint not null default 5 check (short_minutes between 1 and 60),
  long_minutes smallint not null default 15 check (long_minutes between 1 and 90),
  long_every smallint not null default 4 check (long_every between 2 and 12),
  sound boolean not null default true,
  phase text not null default 'focus' check (phase in ('focus', 'short', 'long')),
  status text not null default 'idle' check (status in ('idle', 'running', 'paused')),
  ends_at timestamptz,
  remaining_ms integer not null default 1500000 check (remaining_ms >= 0),
  completed smallint not null default 0 check (completed >= 0),
  task_id uuid,
  updated_at timestamptz not null default now(),
  constraint pomodoro_running_has_end check ((status = 'running') = (ends_at is not null)),
  constraint pomodoro_task_fk foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);
comment on column public.pomodoro_state.updated_at is 'Last change; devices keep the newest state.';
create index pomodoro_state_task_idx on public.pomodoro_state (task_id, user_id);

-- Finished focus sessions (also those without a task), for "sessions today" on every device.
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid,
  minutes smallint not null check (minutes between 1 and 180),
  ended_at timestamptz not null default now(),
  constraint focus_sessions_task_fk foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);
create index focus_sessions_user_ended_idx on public.focus_sessions (user_id, ended_at desc);
create index focus_sessions_task_idx on public.focus_sessions (task_id, user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger clients_touch before update on public.clients for each row execute function private.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function private.touch_updated_at();
create trigger subtasks_touch before update on public.subtasks for each row execute function private.touch_updated_at();
create trigger pomodoro_state_touch before update on public.pomodoro_state for each row execute function private.touch_updated_at();
create trigger tasks_completed_at before insert or update of status, completed_at on public.tasks for each row execute function private.sync_task_completed_at();

-- New account: create its profile and Pomodoro row. Runs as the auth service, so it must
-- bypass RLS (security definer); it lives in the private schema and nobody can call it directly.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)), 120));
  insert into public.pomodoro_state (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Access: signed-in users only, and only their own rows
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'projects', 'tasks', 'subtasks', 'time_entries', 'focus_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, public;
grant select, update on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter table public.pomodoro_state enable row level security;
revoke all on public.pomodoro_state from anon, public;
grant select, insert, update on public.pomodoro_state to authenticated;
create policy pomodoro_state_select_own on public.pomodoro_state for select to authenticated using ((select auth.uid()) = user_id);
create policy pomodoro_state_insert_own on public.pomodoro_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy pomodoro_state_update_own on public.pomodoro_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Sample data import: fills the CALLING user's account with the demo clients,
-- projects, tasks and time. Security invoker, so RLS applies as usual.
-- ---------------------------------------------------------------------------

-- A deadline `workdays` Monday-to-Friday days from today, at hh:00 in `tz`.
create or replace function private.workday_at(tz text, workdays integer, hh integer)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d date := (now() at time zone tz)::date;
  step integer := case when workdays < 0 then -1 else 1 end;
  n_left integer := abs(workdays);
begin
  while n_left > 0 or extract(isodow from d) in (6, 7) loop
    d := d + step;
    if extract(isodow from d) not in (6, 7) then
      n_left := n_left - 1;
    end if;
  end loop;
  return (d + make_time(hh, 0, 0)) at time zone tz;
end;
$$;

create or replace function private.add_sample_task(
  p_project uuid, p_title text, p_description text, p_status text, p_order double precision,
  p_tags text[], p_due timestamptz, p_subtasks text[], p_done_count integer, p_completed timestamptz,
  p_minutes integer[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task uuid;
begin
  insert into public.tasks (project_id, title, description, status, sort_order, tags, due_at, completed_at, created_at)
  values (p_project, p_title, p_description, p_status, p_order, p_tags, p_due, p_completed, now() - interval '6 days')
  returning id into v_task;

  insert into public.subtasks (task_id, title, done, position)
  select v_task, s.title, s.ord <= p_done_count, s.ord * 1000
  from unnest(p_subtasks) with ordinality as s (title, ord);

  -- One entry per day going back from yesterday, at the current time of day.
  insert into public.time_entries (task_id, started_at, ended_at, source)
  select v_task, now() - make_interval(days => m.ord::integer), now() - make_interval(days => m.ord::integer) + make_interval(mins => m.minutes), 'timer'
  from unnest(p_minutes) with ordinality as m (minutes, ord);

  return v_task;
end;
$$;

create or replace function public.import_sample_data()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c_nord uuid; c_harb uuid; c_pine uuid; c_waru uuid;
  p_nord uuid; p_harb uuid; p_pine uuid; p_waru uuid;
begin
  if uid is null then
    raise exception 'Sign in to import sample data' using errcode = '42501';
  end if;
  if exists (select 1 from public.clients where user_id = uid) then
    return jsonb_build_object('imported', false, 'reason', 'account already has clients');
  end if;

  insert into public.clients (name, color, timezone, hourly_rate, currency, contact_name, contact_email)
  values ('Nordlicht Studio', '#0E7490', 'Europe/Berlin', 45, 'EUR', 'Lena', 'lena@nordlicht.example') returning id into c_nord;
  insert into public.clients (name, color, timezone, hourly_rate, currency, contact_name, contact_email)
  values ('Harbour Digital', '#C2410C', 'Australia/Sydney', 70, 'AUD', 'Mia', 'mia@harbour.example') returning id into c_harb;
  insert into public.clients (name, color, timezone, hourly_rate, currency, contact_name, contact_email)
  values ('Pinewood Labs', '#6D28D9', 'America/New_York', 60, 'USD', 'Jordan', 'jordan@pinewood.example') returning id into c_pine;
  insert into public.clients (name, color, timezone, hourly_rate, currency, contact_name, contact_email)
  values ('Warung Rasa', '#15803D', 'Asia/Jakarta', 250000, 'IDR', 'Pak Budi', 'budi@warungrasa.example') returning id into c_waru;

  insert into public.projects (client_id, name) values (c_nord, 'Website refresh') returning id into p_nord;
  insert into public.projects (client_id, name) values (c_harb, 'Mobile app') returning id into p_harb;
  insert into public.projects (client_id, name) values (c_pine, 'Marketing site') returning id into p_pine;
  insert into public.projects (client_id, name) values (c_waru, 'Brand and menu') returning id into p_waru;

  perform private.add_sample_task(p_pine, 'Landing page wireframes', 'Low-fidelity wireframes for the new landing page. Three hero variants.', 'todo', 1000,
    '{Web,Wireframe}', private.workday_at('America/New_York', 3, 21), '{"Collect references","Hero variants","Feature section","Footer"}', 0, null, '{}');
  perform private.add_sample_task(p_waru, 'Menu photo retouch', 'Colour-correct and crop 24 dish photos for the printed menu.', 'todo', 2000,
    '{Photo}', private.workday_at('Asia/Jakarta', 5, 17), '{"Starters","Mains","Desserts","Drinks","Export print sizes","Export web sizes"}', 0, null, '{}');
  perform private.add_sample_task(p_harb, 'Q1 brand moodboard', '', 'todo', 3000,
    '{Branding}', private.workday_at('Australia/Sydney', 11, 17), '{"Gather imagery","Colour directions","Type pairings"}', 1, null, '{45}');
  perform private.add_sample_task(p_nord, 'Hero section redesign', 'New hero for the product page. Client wants a bolder headline and a product shot.', 'in_progress', 1000,
    '{UI,Urgent}', private.workday_at('Europe/Berlin', 1, 17), '{"Audit the current hero","Sketch three layout options","Pick a direction from client notes","High-fidelity desktop version","Mobile breakpoints"}', 3, null, '{130,120}');
  perform private.add_sample_task(p_harb, 'Mobile onboarding flow', '', 'in_progress', 2000,
    '{UX,Mobile}', private.workday_at('Australia/Sydney', 4, 17), '{"User flow","Welcome screen","Permissions","Account setup","Empty states","Prototype"}', 2, null, '{200,190}');
  perform private.add_sample_task(p_nord, 'Pricing page v2', 'Revisions after the client review call.', 'in_revision', 1000,
    '{UI,Web}', private.workday_at('Europe/Berlin', 2, 17), '{"Plan cards","Comparison table","FAQ","Annual toggle","Final polish"}', 4, null, '{180,125}');
  perform private.add_sample_task(p_waru, 'Delivery app icons', '', 'in_revision', 2000,
    '{Icons}', private.workday_at('Asia/Jakarta', 3, 12), '{"Food categories","Status icons","Payment","Navigation","Promo badges","Export SVG"}', 5, null, '{160}');
  perform private.add_sample_task(p_pine, 'Design system audit', 'Inventory of components and inconsistencies.', 'done', 1000,
    '{Audit}', private.workday_at('America/New_York', -2, 9), '{"Inventory","Colour tokens","Type scale","Report"}', 4, now() - interval '2 days', '{240,255}');

  return jsonb_build_object(
    'imported', true,
    'clients', (select count(*) from public.clients where user_id = uid),
    'projects', (select count(*) from public.projects where user_id = uid),
    'tasks', (select count(*) from public.tasks where user_id = uid),
    'subtasks', (select count(*) from public.subtasks where user_id = uid),
    'time_entries', (select count(*) from public.time_entries where user_id = uid)
  );
end;
$$;

-- Function access: new functions are executable by PUBLIC by default; lock that down.
revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.sync_task_completed_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.workday_at(text, integer, integer) from public, anon;
revoke all on function private.add_sample_task(uuid, text, text, text, double precision, text[], timestamptz, text[], integer, timestamptz, integer[]) from public, anon;
revoke all on function public.import_sample_data() from public, anon;

-- The import (security invoker) calls two private helpers, so signed-in users may use exactly those.
grant usage on schema private to authenticated;
grant execute on function private.workday_at(text, integer, integer) to authenticated;
grant execute on function private.add_sample_task(uuid, text, text, text, double precision, text[], timestamptz, text[], integer, timestamptz, integer[]) to authenticated;
grant execute on function public.import_sample_data() to authenticated;
