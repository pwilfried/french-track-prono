-- #502: the push notifications are sent from Supabase, not from a GitHub schedule (run late or
-- skipped when GitHub is busy). Every minute, pg_cron calls the Edge Function
-- `push-notifications` (supabase/functions/), which sends what private.push_due() says is due.
-- The address of the function and the secret it expects live in Vault, written at each tag by the
-- migrations workflow (private.push_set_secrets): no secret here. Without them nothing is called.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Writes (or replaces) the address of the function and its secret in Vault. Deploy only.
create function private.push_set_secrets(p_url text, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_value text;
  v_id uuid;
begin
  foreach v_name in array array['push_notifications_url', 'push_notifications_secret'] loop
    v_value := case v_name when 'push_notifications_url' then p_url else p_secret end;
    select id into v_id from vault.secrets where name = v_name;
    if v_id is null then
      perform vault.create_secret(v_value, v_name);
    else
      perform vault.update_secret(v_id, v_value);
    end if;
  end loop;
end $$;

-- Calls the function (asynchronously, through pg_net), and keeps a week of cron history.
create function private.push_notifications_call() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'push_notifications_url';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_notifications_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end $$;

revoke execute on function private.push_set_secrets(text, text) from public, anon, authenticated;
revoke execute on function private.push_notifications_call() from public, anon, authenticated;

select cron.schedule('push-notifications', '* * * * *', 'select private.push_notifications_call()');
