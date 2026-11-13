-- pgTAP: the home-and-away schedule of a Manager league (#432). Drawn when the mercato closes:
-- 2 × (n − 1) matchdays, each participant once per matchday, each pair twice (once at home
-- each); one competition per matchday in date order, those starting less than 1 h after the
-- close of the mercato left out, the ones left over as bonus matchdays; drawn once; read by the
-- participants only, written by nobody. Rolled back at the end.
begin;
select plan(18);

insert into auth.users (id, email)
select ('a432a432-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 's' || n || '@example.test'
from generate_series(1, 8) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('a432a432-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Calendrier ' || n, now()
from generate_series(1, 8) n;

create function pg_temp.player(p_n int) returns uuid language sql as $$
  select ('a432a432-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'))::uuid
$$;
create function pg_temp.competition(p_n int) returns uuid language sql as $$
  select ('c432c432-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'))::uuid
$$;
create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.player(p_n),
    'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.player(int) to authenticated;
grant execute on function pg_temp.as_player(int) to authenticated;

-- Eight competitions of the league, out of date order. Early starts 30 min after the close of the
-- mercato: left out. C1 to C6 have events and make the 6 matchdays of 4 players; C7 has no event
-- yet (counts from its start date) and is a bonus matchday.
insert into competitions (id, slug, name, starts_on, ends_on)
select pg_temp.competition(n), 'sched-c' || n, 'Calendrier ' || n, current_date + 10 * n,
       current_date + 10 * n
from generate_series(0, 7) n;
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.competition(n), 'sched-100-' || n, '100 m', 'F', now() + n * interval '10 days',
       now() + n * interval '10 days'
from generate_series(1, 6) n;
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at) values
  (pg_temp.competition(0), 'sched-100-0', '100 m', 'F', now() + interval '30 minutes',
   now() + interval '30 minutes');

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at)
values
  ('1a432000-0000-0000-0000-000000000001', 'Saison Paire', pg_temp.player(1), '{}',
   array[pg_temp.competition(7), pg_temp.competition(3), pg_temp.competition(0),
         pg_temp.competition(1), pg_temp.competition(6), pg_temp.competition(2),
         pg_temp.competition(5), pg_temp.competition(4)],
   now() - interval '3 days'),
  ('1a432000-0000-0000-0000-000000000002', 'Saison Impaire', pg_temp.player(5), '{}',
   '{}', now() - interval '3 days'),
  ('1a432000-0000-0000-0000-000000000003', 'Saison Courte', pg_temp.player(5), '{}',
   array[pg_temp.competition(2), pg_temp.competition(1)], now() - interval '3 days');
insert into manager_members (league_id, user_id)
select '1a432000-0000-0000-0000-000000000001', pg_temp.player(n) from generate_series(1, 4) n;
insert into manager_members (league_id, user_id)
select '1a432000-0000-0000-0000-000000000002', pg_temp.player(n) from generate_series(5, 7) n;
insert into manager_members (league_id, user_id)
select '1a432000-0000-0000-0000-000000000003', pg_temp.player(n) from generate_series(5, 8) n;

create temp view t_fixtures as
select * from manager_fixtures where league_id = '1a432000-0000-0000-0000-000000000001';
create temp view t_matchdays as
select * from manager_matchdays where league_id = '1a432000-0000-0000-0000-000000000001';

select is((select count(*)::int from t_fixtures), 0, 'no schedule while the mercato is open');

select setseed(0.432);
update manager_leagues set mercato_closed_at = now()
where id in ('1a432000-0000-0000-0000-000000000001', '1a432000-0000-0000-0000-000000000002',
             '1a432000-0000-0000-0000-000000000003');

select is((select count(*)::int from t_fixtures), 12,
  'the close of the mercato draws 12 head-to-heads for 4 players');
select is((select count(distinct round)::int from t_fixtures), 6,
  'over 2 × (4 − 1) = 6 matchdays');
select is(
  (select count(*)::int from (
     select round, home_id from t_fixtures union select round, away_id from t_fixtures) p),
  24, 'each participant plays once on each matchday');
select is((select count(distinct (home_id, away_id))::int from t_fixtures), 12,
  'each pair meets twice, once at home each');
select is(
  (select count(*)::int from t_fixtures f
   where f.round <= 3
     and exists (select 1 from t_fixtures g
                 where g.round > 3 and g.home_id = f.away_id and g.away_id = f.home_id)),
  6, 'the return leg plays the pairs of the first leg, home and away swapped');
select is(
  (select array_agg(competition_id order by round) from t_matchdays where not bonus),
  array[pg_temp.competition(1), pg_temp.competition(2), pg_temp.competition(3),
        pg_temp.competition(4), pg_temp.competition(5), pg_temp.competition(6)],
  'one competition per head-to-head matchday, in date order');
select is((select count(*)::int from t_matchdays where competition_id = pg_temp.competition(0)), 0,
  'a competition starting less than 1 h after the close of the mercato is left out');
select is(
  (select array_agg((round, competition_id)::text) from t_matchdays where bonus),
  array[(7, pg_temp.competition(7))::text],
  'the competition left after the head-to-heads is a bonus matchday');
select is((select count(*)::int from t_fixtures where round > 6), 0,
  'a bonus matchday has no head-to-head');
select is(
  (select count(*)::int from manager_matchdays
   where league_id = '1a432000-0000-0000-0000-000000000003' and competition_id is null),
  4, 'the head-to-head matchdays beyond the last competition have none');
select is(
  (select count(*)::int from manager_fixtures
   where league_id = '1a432000-0000-0000-0000-000000000002'),
  0, 'no schedule with an odd number of participants');

create temp table t_before as select * from t_fixtures;
select is(private.schedule_manager_season('1a432000-0000-0000-0000-000000000001'), 0,
  'drawing again writes nothing');
select set_eq('select league_id, round, home_id, away_id from t_fixtures',
  'select league_id, round, home_id, away_id from t_before',
  'the schedule never changes');

grant select on t_fixtures to authenticated;
set local role authenticated;
select pg_temp.as_player(2);
select is((select count(*)::int from manager_fixtures), 12,
  'a participant reads the schedule of their league');
select throws_ok(
  $$delete from manager_fixtures where league_id = '1a432000-0000-0000-0000-000000000001'$$,
  '42501', null, 'a participant does not change it');
select is((select count(*)::int from manager_matchdays), 7,
  'a participant reads the matchdays of their league');
select pg_temp.as_player(8);
select is((select count(*)::int from manager_fixtures
           where league_id = '1a432000-0000-0000-0000-000000000001'), 0,
  'a player outside the league does not read it');
reset role;

select * from finish();
rollback;
