-- Welcome email: when a new account's profile is created, ask the send-welcome Edge Function
-- (Resend) to send it. pg_net makes the call after the transaction commits, so a slow or
-- failing email never blocks the sign-up.
create extension if not exists pg_net;

alter table public.profiles add column welcome_sent_at timestamptz;
comment on column public.profiles.welcome_sent_at is 'When the welcome email was sent (set by the send-welcome function; once per account).';
-- Accounts made before this feature do not get a late welcome.
update public.profiles set welcome_sent_at = created_at where welcome_sent_at is null;

-- The sign-up language picks the email's language.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, language)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)), 120),
    case when new.raw_user_meta_data ->> 'lang' = 'id' then 'id' else 'en' end
  );
  insert into public.pomodoro_state (user_id) values (new.id);
  return new;
end;
$$;

create or replace function private.queue_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://msxbtviykckkyqyjdtxq.supabase.co/functions/v1/send-welcome',
    body := jsonb_build_object('user_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- Never let the email stop an account from being created.
  raise warning 'welcome email not queued for %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function private.queue_welcome_email() from public, anon, authenticated;

create trigger profiles_welcome_email
  after insert on public.profiles
  for each row execute function private.queue_welcome_email();
