-- Invoices: bill clients from tracked time or hand-written lines, print or save as PDF.
--
-- profiles gains the business details printed on invoices (company name, address, logo…)
-- and the invoice settings (number prefix, payment terms, tax rates per country).
-- The logo is a small data URL (resized in the browser) so it syncs and prints with no extra
-- storage bucket. Tax rates are a short per-user list, kept as a JSON array.

alter table public.profiles
  add column company_name text not null default '' check (char_length(company_name) <= 160),
  add column company_address text not null default '' check (char_length(company_address) <= 600),
  add column company_email text not null default '' check (char_length(company_email) <= 254),
  add column company_phone text not null default '' check (char_length(company_phone) <= 40),
  add column company_tax_id text not null default '' check (char_length(company_tax_id) <= 60),
  add column company_logo text check (company_logo is null or (char_length(company_logo) <= 400000 and company_logo like 'data:image/%')),
  add column invoice_prefix text not null default 'INV-' check (char_length(invoice_prefix) <= 20),
  add column invoice_due_days smallint not null default 14 check (invoice_due_days between 0 and 365),
  add column invoice_notes text not null default '' check (char_length(invoice_notes) <= 2000),
  add column payment_details text not null default '' check (char_length(payment_details) <= 1000),
  add column tax_rates jsonb not null default '[]' check (jsonb_typeof(tax_rates) = 'array' and jsonb_array_length(tax_rates) <= 50);

comment on column public.profiles.company_logo is 'Optional logo as a data:image/… URL, resized by the app (max ~400 kB).';
comment on column public.profiles.tax_rates is 'Tax rates per country: [{id, country (ISO 3166-1 alpha-2), name, rate (0-100), kind: add|withhold}].';

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The client may be deleted later; the invoice keeps its own copy of the billing details.
  client_id uuid,
  number text not null check (char_length(number) between 1 and 40),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  issue_date date not null default current_date,
  due_date date not null default current_date,
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  bill_to_name text not null default '' check (char_length(bill_to_name) <= 160),
  bill_to_details text not null default '' check (char_length(bill_to_details) <= 600),
  -- [{id, description, quantity, unitPrice, taskId?}]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 200),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  tax_name text not null default '' check (char_length(tax_name) <= 40),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  -- add: VAT/GST/PPN added on top. withhold: tax the client withholds (e.g. PPh 23), deducted.
  tax_kind text not null default 'add' check (tax_kind in ('add', 'withhold')),
  notes text not null default '' check (char_length(notes) <= 2000),
  period_start date,
  period_end date,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_number_per_user unique (user_id, number),
  constraint invoices_due_after_issue check (due_date >= issue_date),
  constraint invoices_period_order check (period_start is null or period_end is null or period_end >= period_start),
  constraint invoices_client_fk foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id)
);

comment on table public.invoices is 'Invoices to clients. Totals are computed from items, discount and tax; nothing is stored twice.';

create index invoices_user_issue_idx on public.invoices (user_id, issue_date desc);
create index invoices_client_idx on public.invoices (client_id, user_id);

create trigger invoices_touch before update on public.invoices for each row execute function private.touch_updated_at();

alter table public.invoices enable row level security;
revoke all on public.invoices from anon, public;
grant select, insert, update, delete on public.invoices to authenticated;
create policy invoices_select_own on public.invoices for select to authenticated using ((select auth.uid()) = user_id);
create policy invoices_insert_own on public.invoices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy invoices_update_own on public.invoices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy invoices_delete_own on public.invoices for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.invoices;
