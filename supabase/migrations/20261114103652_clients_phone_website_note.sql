-- Clients: optional phone number, website and a free-text note.
-- The app adds "https://" to a website typed without one, so stored websites always have a scheme.
alter table public.clients
  add column contact_phone text constraint clients_contact_phone_format check (contact_phone ~ '^[+0-9 ().\/-]{6,30}$'),
  add column website text constraint clients_website_format check (char_length(website) <= 2048 and website ~* '^https?://[^\s]+$'),
  add column note text constraint clients_note_length check (char_length(note) <= 4000);

comment on column public.clients.contact_phone is 'Optional. Digits, spaces and + ( ) . / -, 6 to 30 characters.';
comment on column public.clients.website is 'Optional. Full URL starting with http:// or https://.';
comment on column public.clients.note is 'Optional free text about the client, up to 4000 characters.';
