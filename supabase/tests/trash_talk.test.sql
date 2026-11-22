-- pgTAP: the « Chambrage » family (#1093), sent by private.reminder_due() after the points of an
-- evening, at most one per player and evening, in a league where they have an opponent.
--   One competition: an old final (three days ago) gives the points before the evening; tonight,
--   final 1 (won by athlete 1) and final 2 (won by athlete 3).
--   League « Chambre Une » (players 1 to 4) counts final 1; « Chambre Deux » (players 3, 4, 5)
--   counts finals 1 and 2; « Chambre Seule » (player 6 alone) counts final 1.
--                before  tonight  after   winner of final 1    winner of final 2
--   League 1   1:   10       0      10      missed               -
--              2:    8      12      20      found                -
--              3:    5       3       8      found                -
--              4:    0       1       1      found                -
--   League 2   3:    5       6      11      found                found
--              4:    0       1       1      found                missed
--              5:    0       0       0      missed               missed
-- So: 2 passes 1 (1 is overtaken, which beats being the only one to miss final 1; 2 overtook);
-- 3 is the only one to find final 2 in league 2; 5 ends last with 0 pt in league 2 (which beats
-- being the only one to miss final 1 there); 4 gets nothing; 6, alone in their league, nothing.
-- Rolled back at the end.
begin;
select plan(12);

create function pg_temp.player(p_n int) returns uuid language sql immutable as $$
  select ('c1093000-0000-0000-0000-00000000000' || p_n)::uuid
$$;
create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('c1093000-0000-0000-0000-0000000000a' || p_n)::uuid
$$;
create function pg_temp.event(p_n int) returns uuid language sql immutable as $$
  select ('c1093000-0000-0000-0000-0000000000e' || p_n)::uuid
$$;
create function pg_temp.league(p_n int) returns uuid language sql immutable as $$
  select ('c1093000-0000-0000-0000-0000000000f' || p_n)::uuid
$$;

insert into auth.users (id, email)
select pg_temp.player(n), 'chambre-' || n || '@example.test' from generate_series(1, 6) n;
insert into profiles (id, pseudo, age_confirmed_at)
select pg_temp.player(n), 'Chambreur ' || n, now() from generate_series(1, 6) n;
insert into push_subscriptions (endpoint, user_id, p256dh, auth)
select 'https://push.example.test/chambre-' || n, pg_temp.player(n), 'key', 'auth'
from generate_series(1, 6) n;
-- No quiet hours (0 to 0).
insert into reminder_settings (user_id, quiet_from, quiet_to)
select pg_temp.player(n), 0, 0 from generate_series(1, 6) n;

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'chambre-athlete-' || n, 'Chambre Athlete ' || n, 'FRA', 'F'
from generate_series(1, 4) n;
insert into competitions (id, slug, name, starts_on, ends_on) values
  ('c1093000-0000-0000-0000-0000000000c1', 'chambre-meeting', 'Chambre Meeting',
   current_date - 3, current_date + 1);
-- Open to predictions first: they are moved to their real time once the podiums are in.
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at) values
  (pg_temp.event(0), 'c1093000-0000-0000-0000-0000000000c1', 'chambre-old', '200 m', 'F',
   now() + interval '1 day', now() + interval '1 day'),
  (pg_temp.event(1), 'c1093000-0000-0000-0000-0000000000c1', 'chambre-100m-f', '100 m', 'F',
   now() + interval '1 day', now() + interval '1 day'),
  (pg_temp.event(2), 'c1093000-0000-0000-0000-0000000000c1', 'chambre-800m-f', '800 m', 'F',
   now() + interval '1 day', now() + interval '1 day');
insert into entries (event_id, athlete_id)
select pg_temp.event(e), pg_temp.athlete(a) from generate_series(0, 2) e, generate_series(1, 4) a;

-- The winner each player picks: final 1 is won by athlete 1, final 2 by athlete 3.
insert into predictions (user_id, event_id, p1, p2, p3)
select pg_temp.player(p.n), pg_temp.event(p.e), pg_temp.athlete(p.first),
  pg_temp.athlete(case when p.first = 4 then 2 else 4 end),
  pg_temp.athlete(case when p.first = 3 then 2 else 3 end)
from (values (1, 0, 1), (2, 0, 1), (3, 0, 1), (5, 0, 1),
             (1, 1, 2), (2, 1, 1), (3, 1, 1), (4, 1, 1), (5, 1, 2), (6, 1, 2),
             (3, 2, 3), (4, 2, 1), (5, 2, 1)) p(n, e, first);

insert into leagues (id, name, owner_id) values
  (pg_temp.league(1), 'Chambre Une', pg_temp.player(1)),
  (pg_temp.league(2), 'Chambre Deux', pg_temp.player(3)),
  (pg_temp.league(3), 'Chambre Seule', pg_temp.player(6));
insert into league_competitions (league_id, competition_id)
select pg_temp.league(l), 'c1093000-0000-0000-0000-0000000000c1' from generate_series(1, 3) l;
insert into league_members (league_id, user_id, joined_at)
select pg_temp.league(m.l), pg_temp.player(m.n), now() - interval '10 days'
from (values (1, 1), (1, 2), (1, 3), (1, 4), (2, 3), (2, 4), (2, 5), (3, 6)) m(l, n)
on conflict (league_id, user_id) do update set joined_at = excluded.joined_at;
insert into league_predictions (league_id, user_id, event_id)
select pg_temp.league(x.l), pg_temp.player(x.n), pg_temp.event(x.e)
from (values (1, 1, 0), (1, 2, 0), (1, 3, 0), (1, 1, 1), (1, 2, 1), (1, 3, 1), (1, 4, 1),
             (2, 3, 0), (2, 5, 0), (2, 3, 1), (2, 4, 1), (2, 5, 1),
             (2, 3, 2), (2, 4, 2), (2, 5, 2), (3, 6, 1)) x(l, n, e);

-- The results, then the real times: the old final three days ago, tonight's two hours ago.
insert into results (event_id, athlete_id, rank) values
  (pg_temp.event(0), pg_temp.athlete(1), 1),
  (pg_temp.event(1), pg_temp.athlete(1), 1),
  (pg_temp.event(2), pg_temp.athlete(3), 1);
update events set starts_at = now() - interval '3 days', lock_at = now() - interval '3 days',
  status = 'finished'
where id = pg_temp.event(0);
update events set starts_at = now() - interval '2 hours', lock_at = now() - interval '2 hours',
  status = 'finished'
where id in (pg_temp.event(1), pg_temp.event(2));

-- The points: the old final, then tonight's, computed a minute ago.
insert into score_events (user_id, competition_id, event_id, source, points, reason, created_at)
select pg_temp.player(s.n), 'c1093000-0000-0000-0000-0000000000c1', pg_temp.event(s.e),
  'prediction', s.points, 'test', now() - interval '1 minute'
from (values (1, 0, 10), (2, 0, 8), (3, 0, 5), (5, 0, 0),
             (1, 1, 0), (2, 1, 12), (3, 1, 3), (4, 1, 1), (5, 1, 0), (6, 1, 0),
             (3, 2, 3), (4, 2, 0), (5, 2, 0)) s(n, e, points);

create temp view due as
  select d.user_id, d.kind, d.evening, d.ref, d.payload from private.reminder_due() d
  where d.user_id::text like 'c1093000-%' and d.kind = 'trash_talk';

select results_eq(
  $$ select user_id, payload ->> 'trigger', payload ->> 'league_name', payload ->> 'other',
            payload ->> 'rank', payload ->> 'players'
     from due order by user_id $$,
  $$ values (pg_temp.player(1), 'overtaken', 'Chambre Une', 'Chambreur 2', '2', '4'),
            (pg_temp.player(2), 'overtook', 'Chambre Une', 'Chambreur 1', '1', '4'),
            (pg_temp.player(3), 'lone_find', 'Chambre Deux', null, '1', '3'),
            (pg_temp.player(5), 'last', 'Chambre Deux', null, '3', '3') $$,
  'overtaken, overtook, the only one to find a winner, last with 0 pt: the strongest of each');
select is((select payload -> 'event' ->> 'slug' from due where user_id = pg_temp.player(3)),
  'chambre-800m-f', '…with the final found alone');
select is((select count(*)::int from due where user_id = pg_temp.player(4)), 0,
  'nothing for a player with nothing to tease');
select is((select count(*)::int from due where user_id = pg_temp.player(6)), 0,
  'nothing in a league without an opponent');
select is((select count(*)::int from due group by user_id order by 1 desc limit 1), 1,
  'at most one per player and evening, over all their leagues');

-- Turned off, quiet hours.
update reminder_settings set trash_talk = false where user_id = pg_temp.player(2);
update reminder_settings
set quiet_from = extract(hour from now() at time zone 'Europe/Paris')::int,
    quiet_to = (extract(hour from now() at time zone 'Europe/Paris')::int + 2) % 24
where user_id = pg_temp.player(1);
select is((select count(*)::int from due where user_id in (pg_temp.player(1), pg_temp.player(2))),
  0, 'nothing when « Chambrage » is off, nor during the quiet hours');
update reminder_settings set trash_talk = true, quiet_from = 0, quiet_to = 0
where user_id in (pg_temp.player(1), pg_temp.player(2));

-- An event of the evening not finished: the evening is not over.
update events set status = 'live' where id = pg_temp.event(2);
select is((select count(*)::int from due), 0, 'nothing while an event of the evening is not finished');
update events set status = 'finished' where id = pg_temp.event(2);

-- A blocked player is never named.
update profiles set blocked_at = now() where id = pg_temp.player(2);
select is((select count(*)::int from due where payload ->> 'other' = 'Chambreur 2'), 0,
  'a blocked player is left out of the league');
update profiles set blocked_at = null where id = pg_temp.player(2);

-- The app cannot read it.
set local role authenticated;
select throws_ok($$select * from private.trash_talk_due()$$, '42501', null,
  'the app cannot read the chambrage due');
reset role;

-- Sent: never twice the same evening.
select private.reminder_mark_sent((select jsonb_agg(jsonb_build_object(
  'user_id', user_id, 'kind', kind, 'evening', evening, 'ref', ref)) from due));
select is((select count(*)::int from reminder_log
           where user_id::text like 'c1093000-%' and kind = 'trash_talk'), 4,
  'what was sent is recorded once');
select is((select count(*)::int from due), 0, 'no chambrage is sent twice');
select is((select count(*)::int from private.reminder_due(now() + interval '15 minutes') d
           where d.user_id::text like 'c1093000-%' and d.kind = 'trash_talk'),
  0, 'not even a little later, on another run of the cron');

select * from finish();
rollback;
