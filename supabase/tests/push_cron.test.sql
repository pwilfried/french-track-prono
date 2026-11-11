-- pgTAP: push notifications sent from Supabase (#502). pg_cron calls the Edge Function every
-- minute, with the address and the secret the deploy put in Vault; without them it calls nothing.
begin;
select plan(8);

select is((select schedule from cron.job where jobname = 'push-notifications'), '* * * * *',
  'the push notifications are sent every minute');
select is((select command from cron.job where jobname = 'push-notifications'),
  'select private.push_notifications_call()', 'by the function that calls the Edge Function');

-- Nothing in Vault (local database, before the first deploy): no call.
delete from vault.secrets where name in ('push_notifications_url', 'push_notifications_secret');
select is(private.push_notifications_call(), null, 'nothing is called before the deploy');

-- The deploy writes the address and the secret, twice in a row (a later tag rotates the secret).
select private.push_set_secrets('https://ref.example.test/functions/v1/push-notifications', 'old');
select private.push_set_secrets('https://ref.example.test/functions/v1/push-notifications', 'new');
select is((select count(*)::int from vault.secrets
           where name in ('push_notifications_url', 'push_notifications_secret')), 2,
  'the deploy replaces the secrets instead of adding more');

select isnt(private.push_notifications_call(), null, 'once deployed, the function is called');
select is((select headers ->> 'x-push-secret' from net.http_request_queue order by id desc limit 1),
  'new', 'with the latest secret');
select is((select url from net.http_request_queue order by id desc limit 1),
  'https://ref.example.test/functions/v1/push-notifications', 'at the deployed address');

-- The app never calls it nor reads the secrets.
set local role authenticated;
select throws_ok($$select private.push_notifications_call()$$, '42501', null,
  'the app cannot call the Edge Function through the database');
reset role;

select * from finish();
rollback;
