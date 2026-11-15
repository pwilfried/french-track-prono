-- pgTAP: smart reminders (#681), settings and what the cron sends (private.reminder_due()).
begin;
select plan(16);

-- The clock of the test: the next 18:00 in Paris, so that the evening never spans midnight
-- whatever the hour the suite runs at. Locks stay in the future, points scored now are recent.
create temp table clock as
  select case when t >= now() then t else t + interval '1 day' end as t0
  from (select (date_trunc('day', now() at time zone 'Europe/Paris') + interval '18 hours')
                 at time zone 'Europe/Paris' as t) x;
grant select on clock to authenticated;

-- Three finals of one competition with a start list: locking at 18:10, 18:40 and 18:50, starting
-- together at 20:00 (one evening).
create temp table finals as
  select e.id, e.slug, e.competition_id, row_number() over (order by e.slug) as n from events e
  where e.round = 'final' and (select count(*) from entries x where x.event_id = e.id) >= 3
    and e.competition_id = (
      select competition_id from events f
      where f.round = 'final' and (select count(*) from entries x where x.event_id = f.id) >= 3
      group by competition_id having count(*) >= 3 order by competition_id limit 1)
  order by e.slug limit 3;
update competitions set odds_enabled = false where id = (select competition_id from finals limit 1);
update events set starts_at = (select t0 from clock) + interval '2 hours', status = 'upcoming',
  lock_at = (select t0 from clock) + case (select n from finals f where f.id = events.id)
                      when 1 then interval '10 minutes' when 2 then interval '40 minutes'
                      else interval '50 minutes' end
where id in (select id from finals);

-- A podium of the start list for a player.
create function pg_temp.predict(p_user uuid, p_n int) returns void language sql as $$
  insert into predictions (user_id, event_id, p1, p2, p3)
  select p_user, f.id, a[1], a[2], a[3]
  from finals f,
       lateral (select array_agg(athlete_id) a from (select athlete_id from entries x
                where x.event_id = f.id order by athlete_id limit 3) y) athletes
  where f.n = p_n
$$;

-- A misses finals 1 and 2, B posted all three, C turned « Pronos oubliés » off, D is in their
-- quiet hours, E chose 30 minutes. All play the competition (final 3) and have a device.
insert into auth.users (id, email)
select ('abab0000-0000-0000-0000-00000000000' || c)::uuid, 'remind-' || c || '@example.test'
from unnest(array['a', 'b', 'c', 'd', 'e']) c;
insert into profiles (id, pseudo, age_confirmed_at)
select ('abab0000-0000-0000-0000-00000000000' || c)::uuid, 'Rappel' || upper(c), now()
from unnest(array['a', 'b', 'c', 'd', 'e']) c;
insert into push_subscriptions (endpoint, user_id, p256dh, auth)
select 'https://push.example.test/remind-' || c, ('abab0000-0000-0000-0000-00000000000' || c)::uuid,
  'key', 'auth'
from unnest(array['a', 'b', 'c', 'd', 'e']) c;
select pg_temp.predict(('abab0000-0000-0000-0000-00000000000' || c)::uuid, 3)
from unnest(array['a', 'b', 'c', 'd', 'e']) c;
select pg_temp.predict('abab0000-0000-0000-0000-00000000000b', 1);
select pg_temp.predict('abab0000-0000-0000-0000-00000000000b', 2);

-- Settings, saved by each player for themself. No quiet hours (0 to 0) except for D.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"abab0000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select save_reminder_settings(true, true, true, true, true, 60, 0, 0)$$,
  'a player saves their reminder settings');
select lives_ok($$select save_reminder_settings(true, true, true, true, true, 60, 0, 0)$$,
  'saving again replaces them');
select throws_ok($$select save_reminder_settings(true, true, true, true, true, 5, 0, 0)$$,
  '23514', null, 'a lead not offered is refused');
select throws_ok($$select save_reminder_settings(true, true, true, true, true, 60, 24, 0)$$,
  '23514', null, 'an hour that does not exist is refused');
select throws_ok($$insert into reminder_settings (user_id) values (auth.uid())$$,
  '42501', null, 'the table is not written directly');
select throws_ok($$select * from private.reminder_due()$$, '42501', null,
  'the app cannot read what is due');
select set_config('request.jwt.claims', '{"sub":"abab0000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select save_reminder_settings(true, true, true, true, true, 60, 0, 0);
select is((select count(*)::int from reminder_settings), 1, 'a player only reads their own settings');
select set_config('request.jwt.claims', '{"sub":"abab0000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select save_reminder_settings(false, true, true, true, true, 60, 0, 0);
select set_config('request.jwt.claims', '{"sub":"abab0000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
-- Quiet from the hour of the test clock in Paris to the next one.
select save_reminder_settings(true, true, true, true, true, 60,
  extract(hour from (select t0 from clock) at time zone 'Europe/Paris')::int,
  (extract(hour from (select t0 from clock) at time zone 'Europe/Paris')::int + 1) % 24);
select set_config('request.jwt.claims', '{"sub":"abab0000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select save_reminder_settings(true, true, true, true, true, 30, 0, 0);
reset role;

create temp view due as
  select d.user_id, d.kind, d.payload from private.reminder_due((select t0 from clock)) d
  where d.user_id::text like 'abab0000-%';

select is((select jsonb_path_query_array(payload, '$.events[*].slug') from due
           where user_id = 'abab0000-0000-0000-0000-00000000000a' and kind = 'forgotten'),
  (select jsonb_agg(slug order by n) from finals where n in (1, 2)),
  'one message for every final of the evening locking within the hour');
select is((select count(*)::int from due where user_id = 'abab0000-0000-0000-0000-00000000000b'),
  0, 'a player who posted every podium gets nothing');
select is((select count(*)::int from due
           where user_id in ('abab0000-0000-0000-0000-00000000000c', 'abab0000-0000-0000-0000-00000000000d')),
  0, 'nothing for a player who turned the family off, nor during their quiet hours');
select is((select jsonb_path_query_array(payload, '$.events[*].slug') from due
           where user_id = 'abab0000-0000-0000-0000-00000000000e'),
  (select jsonb_agg(slug) from finals where n = 1), 'the lead chosen by the player');

-- Sent: never twice the same evening, even for a final reaching the window later.
select private.reminder_mark_sent((select jsonb_agg(jsonb_build_object(
  'user_id', d.user_id, 'kind', d.kind, 'evening', d.evening))
  from private.reminder_due((select t0 from clock)) d where d.user_id::text like 'abab0000-%'));
select private.reminder_mark_sent((select jsonb_agg(jsonb_build_object(
  'user_id', d.user_id, 'kind', d.kind, 'evening', d.evening))
  from private.reminder_due((select t0 from clock)) d where d.user_id::text like 'abab0000-%'));
select is((select count(*)::int from reminder_log where user_id::text like 'abab0000-%'), 2,
  'what was sent is recorded once');
select is((select count(*)::int
           from private.reminder_due((select t0 from clock) + interval '15 minutes') d
           where d.user_id in ('abab0000-0000-0000-0000-00000000000a',
                               'abab0000-0000-0000-0000-00000000000e')),
  0, 'at most one « Pronos oubliés » per player and evening');

-- Résultats du soir: B gets one recap once the three finals have their points.
insert into score_events (user_id, competition_id, event_id, source, points, reason)
select 'abab0000-0000-0000-0000-00000000000b', competition_id, id, 'prediction', 5 * n::int, 'test'
from finals where n in (1, 2);
select is((select count(*)::int from due
           where user_id = 'abab0000-0000-0000-0000-00000000000b' and kind = 'recap'),
  0, 'no recap while a final of the evening has no points');
insert into score_events (user_id, competition_id, event_id, source, points, reason)
select 'abab0000-0000-0000-0000-00000000000b', competition_id, id, 'prediction', 3, 'test'
from finals where n = 3;
select is((select concat_ws('/', payload ->> 'points', payload ->> 'finals',
                             (payload ->> 'rank') is not null) from due
           where user_id = 'abab0000-0000-0000-0000-00000000000b' and kind = 'recap'),
  '18/3/t',
  'one recap with the points of the evening and the place');
select private.reminder_mark_sent(jsonb_build_array(jsonb_build_object(
  'user_id', 'abab0000-0000-0000-0000-00000000000b', 'kind', 'recap',
  'evening', (select d.evening from private.reminder_due((select t0 from clock)) d
              where d.user_id = 'abab0000-0000-0000-0000-00000000000b' and d.kind = 'recap'))));
select is((select count(*)::int from due where user_id = 'abab0000-0000-0000-0000-00000000000b'),
  0, 'the recap is sent once');

select * from finish();
rollback;
