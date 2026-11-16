-- Units for invoice lines ("Hour", "Pcs", "Day"…), defined by each user in Settings.
-- Each line stores its unit name in invoices.items, so old invoices keep what they printed.
alter table public.profiles
  add column invoice_units jsonb not null default '["Hour", "Pcs"]'
    check (jsonb_typeof(invoice_units) = 'array' and jsonb_array_length(invoice_units) <= 30);

comment on column public.profiles.invoice_units is 'Unit names offered on invoice lines, e.g. ["Hour", "Pcs"]. The first one containing "hour" (or the first) is used for tracked time.';
