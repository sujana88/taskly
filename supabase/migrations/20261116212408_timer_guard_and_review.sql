-- Forgotten timers: an entry stopped automatically (after the maximum length) is marked for
-- review and is left out of invoices until the user checks it.
alter table public.time_entries add column needs_review boolean not null default false;
comment on column public.time_entries.needs_review is 'Stopped automatically (forgotten timer). Not billed until the user marks it as checked.';

-- Per-user timer safety settings: remind after N hours, ask after N idle minutes, stop after N hours.
alter table public.profiles
  add column timer_guard jsonb not null default '{"remindHours": 3, "idleMinutes": 10, "maxHours": 12}'
    check (jsonb_typeof(timer_guard) = 'object');
comment on column public.profiles.timer_guard is 'Timer safety: {remindHours, idleMinutes, maxHours}.';
