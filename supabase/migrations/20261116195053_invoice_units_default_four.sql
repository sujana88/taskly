-- Default units: Hour, Hours, Service, Project. Accounts still on the untouched previous
-- default (Hours, Project) follow along; lists someone edited are left alone.
alter table public.profiles alter column invoice_units set default '["Hour", "Hours", "Service", "Project"]';
update public.profiles set invoice_units = '["Hour", "Hours", "Service", "Project"]' where invoice_units = '["Hours", "Project"]'::jsonb;
