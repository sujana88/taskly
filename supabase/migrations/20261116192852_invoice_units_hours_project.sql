-- Default units become "Hours" (time is rarely billed as a single hour) and "Project" (fits
-- freelance work better than "Pcs"). Accounts still on the untouched old default follow along;
-- lists someone edited are left alone.
alter table public.profiles alter column invoice_units set default '["Hours", "Project"]';
update public.profiles set invoice_units = '["Hours", "Project"]' where invoice_units = '["Hour", "Pcs"]'::jsonb;
