-- Realtime casts changed values to the column's base type without its length: char(3) becomes
-- character (= char(1)), so "IDR" reached other devices as "I". text keeps the full code; the
-- existing check constraints still allow only three capital letters.
alter table public.clients alter column currency type text;
alter table public.invoices alter column currency type text;
