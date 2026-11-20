alter table public.profiles add column if not exists exchange_rates jsonb;
comment on column public.profiles.exchange_rates is 'Invoice exchange rates set in Settings: {"date":"2026-11-20","rates":{"USD":1,"IDR":18263,...}} (1 US $ in each currency). Null = app defaults.';
