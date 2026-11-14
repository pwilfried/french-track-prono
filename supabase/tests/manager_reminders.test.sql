-- pgTAP: the Manager reminders (#836), sent by private.reminder_due() in the « Manager » family.
--   League A: mercato open, its first round ends in 1 h.
--   League B: season under way. Matchday 1 (c1) locks in 30 min, matchday 2 (c2) is over and
--   scored: player 1 (120) beats player 2 (90).
--   Player 1 validated their lineup of c1, player 2 did not, player 3 turned the family off,
--   player 4 is in their quiet hours. All have a device.
-- Rolled back at the end.
begin;
select plan(10);

-- Only the athlete of this test is in the catalogue: everybody can still recruit.
update athletes set manager_price = null where manager_price is not null;
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('ac830000-0000-0000-0000-0000000000a1', 'rappel-manager', 'Rappel Athlete', 'FRA', 'F', 10);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('ac830000-0000-0000-0000-0000000000a1', '100 m', true);

insert into auth.users (id, email)
select ('ac830000-0000-0000-0000-00000000000' || n)::uuid, 'manager-' || n || '@example.test'
from generate_series(1, 4) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('ac830000-0000-0000-0000-00000000000' || n)::uuid,
  (array['Rappel Une', 'Rappel Deux', 'Rappel Trois', 'Rappel Quatre'])[n], now()
from generate_series(1, 4) n;
insert into push_subscriptions (endpoint, user_id, p256dh, auth)
select 'https://push.example.test/manager-' || n, ('ac830000-0000-0000-0000-00000000000' || n)::uuid,
  'key', 'auth'
from generate_series(1, 4) n;
-- No quiet hours (0 to 0), except for player 4: from the current hour in Paris for two hours, so
-- that they still cover the later run of the cron (now + 15 min) even near the end of an hour.
insert into reminder_settings (user_id, manager, quiet_from, quiet_to)
select ('ac830000-0000-0000-0000-00000000000' || n)::uuid, n <> 3,
  case when n = 4 then extract(hour from now() at time zone 'Europe/Paris')::int else 0 end,
  case when n = 4 then (extract(hour from now() at time zone 'Europe/Paris')::int + 2) % 24 else 0 end
from generate_series(1, 4) n;

create function pg_temp.player(p_n int) returns uuid language sql immutable as $$
  select ('ac830000-0000-0000-0000-00000000000' || p_n)::uuid
$$;
create function pg_temp.competition(p_n int) returns uuid language sql immutable as $$
  select ('ac830000-0000-0000-0000-0000000000c' || p_n)::uuid
$$;

insert into competitions (id, slug, name, starts_on, ends_on) values
  (pg_temp.competition(1), 'rappel-c1', 'Rappel Meeting', current_date, current_date + 1),
  (pg_temp.competition(2), 'rappel-c2', 'Rappel Gala', current_date - 1, current_date);
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at, status) values
  (pg_temp.competition(1), 'rappel-e1', '100 m', 'F', now() + interval '30 minutes',
   now() + interval '30 minutes', 'upcoming'),
  (pg_temp.competition(2), 'rappel-e2', '100 m', 'F', now() - interval '1 day',
   now() - interval '1 day', 'finished');

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at) values
  ('ac830000-0000-0000-0000-0000000000f1', 'Rappel Mercato', pg_temp.player(1),
   '{"budget": 40, "rounds": {"firstHours": 48, "longRounds": 2, "nextHours": 24}}', '{}',
   now() - interval '47 hours', null),
  ('ac830000-0000-0000-0000-0000000000f2', 'Rappel Saison', pg_temp.player(1), '{}',
   array[pg_temp.competition(1), pg_temp.competition(2)], now() - interval '5 days',
   now() - interval '2 days');
insert into manager_members (league_id, user_id)
select l, pg_temp.player(n)
from unnest(array['ac830000-0000-0000-0000-0000000000f1', 'ac830000-0000-0000-0000-0000000000f2']::uuid[]) l,
     generate_series(1, 4) n;
insert into manager_matchdays (league_id, round, competition_id) values
  ('ac830000-0000-0000-0000-0000000000f2', 1, pg_temp.competition(1)),
  ('ac830000-0000-0000-0000-0000000000f2', 2, pg_temp.competition(2));
insert into manager_fixtures (league_id, round, home_id, away_id) values
  ('ac830000-0000-0000-0000-0000000000f2', 1, pg_temp.player(1), pg_temp.player(2)),
  ('ac830000-0000-0000-0000-0000000000f2', 1, pg_temp.player(3), pg_temp.player(4)),
  ('ac830000-0000-0000-0000-0000000000f2', 2, pg_temp.player(1), pg_temp.player(2)),
  ('ac830000-0000-0000-0000-0000000000f2', 2, pg_temp.player(3), pg_temp.player(4));
insert into manager_lineups (league_id, competition_id, user_id, athlete_ids) values
  ('ac830000-0000-0000-0000-0000000000f2', pg_temp.competition(1), pg_temp.player(1),
   array['ac830000-0000-0000-0000-0000000000a1']::uuid[]);
insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian, bonus,
                            predictions)
select 'ac830000-0000-0000-0000-0000000000f2', pg_temp.competition(2), pg_temp.player(n), true,
  s, s, 0, 0
from (values (1, 120), (2, 90), (3, 50), (4, 60)) t(n, s);

create temp view due as
  select d.user_id, d.kind, d.evening, d.ref, d.payload from private.reminder_due() d
  where d.user_id::text like 'ac830000-%';

select is((select array_agg(user_id order by user_id) from due where kind = 'mercato_round'),
  array[pg_temp.player(1), pg_temp.player(2)],
  'the end of a mercato round in 2 h, to every participant who can still recruit');
select is((select payload ->> 'round' from due where kind = 'mercato_round' limit 1), '1',
  '…with the round it is about');
select is((select array_agg(user_id) from due where kind = 'lineup'), array[pg_temp.player(2)],
  'a manager who validated their lineup gets nothing; one who did not hears it before the lock');
select is((select payload ->> 'competition_slug' from due where kind = 'lineup'), 'rappel-c1',
  '…with the competition to line up for');
select is((select concat_ws('/', payload ->> 'my_score', payload ->> 'their_score',
                             payload ->> 'opponent', payload ->> 'round')
           from due where kind = 'duel_over' and user_id = pg_temp.player(1)),
  '120/90/Rappel Deux/2', 'a head-to-head over, told to each player from their side');
select is((select count(*)::int from due
           where user_id in (pg_temp.player(3), pg_temp.player(4))),
  0, 'nothing when the Manager family is off, nor during the quiet hours');

update events set status = 'live' where slug = 'rappel-e2';
select is((select count(*)::int from due where kind = 'duel_over'), 0,
  'no head-to-head over while an event of its competition is not finished');
update events set status = 'finished' where slug = 'rappel-e2';

-- Sent: never twice the same round or competition.
select private.reminder_mark_sent((select jsonb_agg(jsonb_build_object(
  'user_id', user_id, 'kind', kind, 'evening', evening, 'ref', ref)) from due));
select private.reminder_mark_sent((select jsonb_agg(jsonb_build_object(
  'user_id', user_id, 'kind', kind, 'evening', evening, 'ref', ref))
  from private.reminder_due() d where d.user_id::text like 'ac830000-%'));
select is((select count(*)::int from reminder_log where user_id::text like 'ac830000-%'), 5,
  'what was sent is recorded once');
select is((select count(*)::int from due), 0, 'no reminder is sent twice');
select is((select count(*)::int from private.reminder_due(now() + interval '15 minutes') d
           where d.user_id::text like 'ac830000-%'),
  0, 'not even a little later, on another run of the cron');

select * from finish();
rollback;
