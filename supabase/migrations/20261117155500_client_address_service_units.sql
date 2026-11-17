-- Clients: an optional postal address, copied onto invoices under "Billed to".
alter table public.clients
  add column address text constraint clients_address_length check (char_length(address) <= 600);
comment on column public.clients.address is 'Optional postal address, printed on invoices under "Billed to".';

-- The "Service" unit reads better as "Service(s)", like "Project(s)".
alter table public.profiles alter column invoice_units set default '["Hour", "Hours", "Service(s)", "Project(s)"]';
update public.profiles
set invoice_units = (
  select jsonb_agg(case when u = '"Service"'::jsonb then '"Service(s)"'::jsonb else u end order by i)
  from jsonb_array_elements(invoice_units) with ordinality as e(u, i)
)
where invoice_units @> '["Service"]'::jsonb;
