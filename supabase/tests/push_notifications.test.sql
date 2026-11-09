-- pgTAP: push notifications (#203), who gets what and when.
begin;
select plan(12);

-- Two finals of the same competition with a start list, locking in 10 minutes.
create temp table finals as
  select e.id, e.slug, e.competition_id from events e
  where e.round = 'final' and (select count(*) from entries n where n.event_id = e.id) >= 3
    and e.competition_id = (select competition_id from events where round = 'final'
                            group by competition_id having count(*) >= 2 limit 1)
  order by e.slug limit 2;
update competitions set odds_enabled = false where id = (select competition_id from finals limit 1);
update events set starts_at = now() + interval '1 hour', lock_at = now() + interval '10 minutes',
  status = 'upcoming' where id in (select id from finals);

-- A plays the competition (a prediction on the 2nd final), B never played it, C has no device.
insert into auth.users (id, email) values
  ('cdcdcdcd-0000-0000-0000-00000000000a', 'push-a@example.test'),
  ('cdcdcdcd-0000-0000-0000-00000000000b', 'push-b@example.test'),
  ('cdcdcdcd-0000-0000-0000-00000000000c', 'push-c@example.test'),
  ('cdcdcdcd-0000-0000-0000-00000000000d', 'push-d@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cdcdcdcd-0000-0000-0000-00000000000a', 'PushA', now()),
  ('cdcdcdcd-0000-0000-0000-00000000000b', 'PushB', now()),
  ('cdcdcdcd-0000-0000-0000-00000000000c', 'PushC', now()),
  ('cdcdcdcd-0000-0000-0000-00000000000d', 'PushD', now());
insert into predictions (user_id, event_id, p1, p2, p3)
select u.id, f.id, a[1], a[2], a[3]
from (select id from finals order by slug offset 1) f,
     (select array_agg(athlete_id) a from (select athlete_id from entries
       where event_id = (select id from finals order by slug offset 1) limit 3) x) athletes,
     (values ('cdcdcdcd-0000-0000-0000-00000000000a'::uuid),
             ('cdcdcdcd-0000-0000-0000-00000000000c'::uuid)) u(id);

-- Devices, saved by each player for themself.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cdcdcdcd-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select save_push_subscription('https://push.example.test/a', 'key-a', 'auth-a')$$,
  'a player turns notifications on');
select set_config('request.jwt.claims', '{"sub":"cdcdcdcd-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select save_push_subscription('https://push.example.test/b', 'key-b', 'auth-b');
select is((select count(*)::int from push_subscriptions), 1, 'a player only sees their own devices');
select lives_ok($$select delete_push_subscription('https://push.example.test/a')$$, 'deleting another player''s device does nothing');
select throws_ok($$insert into push_subscriptions values ('https://x.test', auth.uid(), 'k', 'a')$$,
  '42501', null, 'the table is not written directly');
select throws_ok($$select * from private.push_due()$$, '42501', null, 'the app cannot read what is due');
reset role;
select is((select user_id from push_subscriptions where endpoint = 'https://push.example.test/a'),
  'cdcdcdcd-0000-0000-0000-00000000000a'::uuid, 'the device is still there');
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/d', 'cdcdcdcd-0000-0000-0000-00000000000d', 'key-d', 'auth-d');

-- Only A is reminded, of the final not predicted yet.
select is((select array_agg(kind || ':' || event_slug) from private.push_due()
           where user_id::text like 'cdcdcdcd-%'),
  array['reminder:' || (select slug from finals order by slug limit 1)],
  'a reminder for the unpredicted final, only to a player of the competition');
select is((select jsonb_array_length(devices) from private.push_due()
           where user_id = 'cdcdcdcd-0000-0000-0000-00000000000a'), 1, 'with the player''s devices');

-- Sent: not twice, and nothing else within the hour.
select private.push_mark_sent(jsonb_build_array(jsonb_build_object(
  'user_id', 'cdcdcdcd-0000-0000-0000-00000000000a',
  'event_slug', (select slug from finals order by slug limit 1), 'kind', 'reminder')));
insert into score_events (user_id, competition_id, event_id, source, points, reason)
select 'cdcdcdcd-0000-0000-0000-00000000000a', competition_id, id, 'prediction', 9, 'test'
from finals order by slug offset 1 limit 1;
select is((select count(*)::int from private.push_due() where user_id = 'cdcdcdcd-0000-0000-0000-00000000000a'),
  0, 'one notification an hour at most');

-- Points computed: D hears about them, unless blocked.
insert into score_events (user_id, competition_id, event_id, source, points, reason)
select 'cdcdcdcd-0000-0000-0000-00000000000d', competition_id, id, 'prediction', 11, 'test'
from finals order by slug offset 1 limit 1;
select is((select kind || ':' || points from private.push_due()
           where user_id = 'cdcdcdcd-0000-0000-0000-00000000000d'), 'result:11', 'the points once computed');
update profiles set blocked_at = now() where id = 'cdcdcdcd-0000-0000-0000-00000000000d';
select is((select count(*)::int from private.push_due() where user_id = 'cdcdcdcd-0000-0000-0000-00000000000d'),
  0, 'a blocked player gets nothing');

-- A device the push service forgot is removed.
select private.push_forget(array['https://push.example.test/d']);
select is((select count(*)::int from push_subscriptions where endpoint = 'https://push.example.test/d'),
  0, 'a forgotten device is removed');

select * from finish();
rollback;
