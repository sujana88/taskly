-- Task label: how important the task is. Optional; shown as a coloured pill on the card.
alter table public.tasks
  add column priority text check (priority in ('low', 'medium', 'high'));
comment on column public.tasks.priority is 'Optional label: low (green), medium (yellow) or high (blue).';
