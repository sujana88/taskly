-- The "Project" unit reads better as "Project(s)" (a line can bill one project or several).
alter table public.profiles alter column invoice_units set default '["Hour", "Hours", "Service", "Project(s)"]';
update public.profiles
set invoice_units = (
  select jsonb_agg(case when u = '"Project"'::jsonb then '"Project(s)"'::jsonb else u end order by i)
  from jsonb_array_elements(invoice_units) with ordinality as e(u, i)
)
where invoice_units @> '["Project"]'::jsonb;
