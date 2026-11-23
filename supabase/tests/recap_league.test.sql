-- pgTAP: « Résultats du soir » with the place in the player's main league (#1156).
begin;
select plan(5);

-- The clock of the test: the next 18:00 in Paris (outside the default quiet hours), as in
-- reminders.test.sql.
create temp table clock as
  select case when t >= now() then t else t + interval '1 day' end as t0
  from (select (date_trunc('day', now() at time zone 'Europe/Paris') + interval '18 hours')
                 at time zone 'Europe/Paris' as t) x;

-- Two finals of one competition, the same evening: the first at 20:00, the second at 21:00.
create temp table finals as
  select e.id, e.slug, e.competition_id, row_number() over (order by e.slug) as n from events e
  where e.round = 'final' and (select count(*) from entries x where x.event_id = e.id) >= 3
    and e.competition_id = (
      select competition_id from events f
      where f.round = 'final' and (select count(*) from entries x where x.event_id = f.id) >= 3
      group by competition_id having count(*) >= 2 order by competition_id limit 1)
  order by e.slug limit 2;
update competitions set odds_enabled = false where id = (select competition_id from finals limit 1);
update events set status = 'upcoming',
  starts_at = (select t0 from clock) + case (select n from finals f where f.id = events.id)
                when 1 then interval '2 hours' else interval '3 hours' end,
  lock_at = (select t0 from clock) + interval '10 minutes'
where id in (select id from finals);

-- Players 1 to 4 are in « Grande » (4 members) and 1, 2 in « Petite » (2 members); 1 to 5 in
-- « Muette » (5 members), where 1 added nothing. 6 and 7 are both in « Ancienne » and « Récente »
-- (2 members each). 8 is in no league. All count the competition.
insert into auth.users (id, email)
select ('adad0000-0000-0000-0000-00000000000' || c)::uuid, 'recap-league-' || c || '@example.test'
from unnest(array['1', '2', '3', '4', '5', '6', '7', '8']) c;
insert into profiles (id, pseudo, age_confirmed_at)
select ('adad0000-0000-0000-0000-00000000000' || c)::uuid, 'RecapLigue' || c, now()
from unnest(array['1', '2', '3', '4', '5', '6', '7', '8']) c;
insert into push_subscriptions (endpoint, user_id, p256dh, auth)
select 'https://push.example.test/recap-league-' || c,
  ('adad0000-0000-0000-0000-00000000000' || c)::uuid, 'key', 'auth'
from unnest(array['1', '6', '8']) c;
insert into leagues (id, name, owner_id, created_at) values
  ('adad1000-0000-0000-0000-000000000001', 'Grande', 'adad0000-0000-0000-0000-000000000001', now()),
  ('adad1000-0000-0000-0000-000000000002', 'Petite', 'adad0000-0000-0000-0000-000000000001', now()),
  ('adad1000-0000-0000-0000-000000000003', 'Muette', 'adad0000-0000-0000-0000-000000000001', now()),
  ('adad1000-0000-0000-0000-000000000004', 'Récente', 'adad0000-0000-0000-0000-000000000006', now()),
  ('adad1000-0000-0000-0000-000000000005', 'Ancienne', 'adad0000-0000-0000-0000-000000000006',
   now() - interval '1 day');
insert into league_members (league_id, user_id)
select ('adad1000-0000-0000-0000-00000000000' || l)::uuid,
  ('adad0000-0000-0000-0000-00000000000' || u)::uuid
from (values ('1', '1'), ('1', '2'), ('1', '3'), ('1', '4'), ('2', '1'), ('2', '2'),
             ('3', '1'), ('3', '2'), ('3', '3'), ('3', '4'), ('3', '5'),
             ('4', '6'), ('4', '7'), ('5', '6'), ('5', '7')) m(l, u);
insert into league_competitions (league_id, competition_id)
select ('adad1000-0000-0000-0000-00000000000' || l)::uuid, (select competition_id from finals limit 1)
from unnest(array['1', '2', '3', '4', '5']) l;

-- A podium of the start list for a player on a final, with its points, added to some leagues.
create function pg_temp.scored(p_user text, p_n int, p_points int, p_leagues text[])
returns void language sql as $$
  insert into predictions (user_id, event_id, p1, p2, p3)
  select ('adad0000-0000-0000-0000-00000000000' || p_user)::uuid, f.id, a[1], a[2], a[3]
  from finals f,
       lateral (select array_agg(athlete_id) a from (select athlete_id from entries x
                where x.event_id = f.id order by athlete_id limit 3) y) athletes
  where f.n = p_n;
  insert into league_predictions (league_id, user_id, event_id)
  select ('adad1000-0000-0000-0000-00000000000' || l)::uuid,
    ('adad0000-0000-0000-0000-00000000000' || p_user)::uuid, f.id
  from finals f, unnest(p_leagues) l where f.n = p_n;
  insert into score_events (user_id, competition_id, event_id, source, points, reason)
  select ('adad0000-0000-0000-0000-00000000000' || p_user)::uuid, f.competition_id, f.id,
    'prediction', p_points, 'test'
  from finals f where f.n = p_n;
$$;

-- In « Grande »: 1 scores 5 + 10, 2 scores 20, 3 scores 3, 4 plays nothing that evening.
select pg_temp.scored('1', 1, 5, array['1', '2']);
select pg_temp.scored('1', 2, 10, array['1']);
select pg_temp.scored('2', 1, 20, array['1', '2', '3']);
select pg_temp.scored('3', 1, 3, array['1', '3']);
select pg_temp.scored('6', 1, 4, array['4', '5']);
select pg_temp.scored('8', 1, 2, array[]::text[]);

create temp view due as
  select d.user_id, d.payload from private.reminder_due((select t0 from clock)) d
  where d.user_id::text like 'adad0000-%' and d.kind = 'recap';

select is((select payload ->> 'league_name' from due
           where user_id = 'adad0000-0000-0000-0000-000000000001'),
  'Grande', 'the main league is the one with the most members the player added a final to');
select is((select concat_ws('/', payload ->> 'league_rank', payload ->> 'league_players') from due
           where user_id = 'adad0000-0000-0000-0000-000000000001'),
  '2/3', 'the place in the league on the evening, among the members who scored there');
select is((select payload ->> 'league_event_slug' from due
           where user_id = 'adad0000-0000-0000-0000-000000000001'),
  (select slug from finals where n = 2), 'the link goes to the last final of the evening');
select is((select payload ->> 'league_name' from due
           where user_id = 'adad0000-0000-0000-0000-000000000006'),
  'Ancienne', 'the oldest league on a tie');
select is((select concat_ws('/', payload ->> 'points', payload ? 'league_id',
                             payload ->> 'league_id') from due
           where user_id = 'adad0000-0000-0000-0000-000000000008'),
  '2/true', 'no league for a player without one: the recap keeps the competition only');

select * from finish();
rollback;
