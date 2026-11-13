-- pgTAP: the home-and-away schedule of a Manager league (#432). Drawn when the mercato closes:
-- 2 × (n − 1) matchdays, each participant once per matchday, each pair twice (once at home
-- each); one eligible competition per matchday, first one first; drawn once; read by the
-- participants only, written by nobody. Rolled back at the end.
begin;
select plan(14);

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

-- Three competitions, out of date order in the league: fewer than the 6 matchdays of 4 players.
insert into competitions (id, slug, name, starts_on, ends_on) values
  (pg_temp.competition(1), 'sched-c1', 'Calendrier Un', current_date + 10, current_date + 10),
  (pg_temp.competition(2), 'sched-c2', 'Calendrier Deux', current_date + 20, current_date + 20),
  (pg_temp.competition(3), 'sched-c3', 'Calendrier Trois', current_date + 30, current_date + 30);

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at)
values
  ('1a432000-0000-0000-0000-000000000001', 'Saison Paire', pg_temp.player(1), '{}',
   array[pg_temp.competition(3), pg_temp.competition(1), pg_temp.competition(2)],
   now() - interval '3 days'),
  ('1a432000-0000-0000-0000-000000000002', 'Saison Impaire', pg_temp.player(5), '{}',
   '{}', now() - interval '3 days');
insert into manager_members (league_id, user_id)
select '1a432000-0000-0000-0000-000000000001', pg_temp.player(n) from generate_series(1, 4) n;
insert into manager_members (league_id, user_id)
select '1a432000-0000-0000-0000-000000000002', pg_temp.player(n) from generate_series(5, 7) n;

create temp view t_fixtures as
select * from manager_fixtures where league_id = '1a432000-0000-0000-0000-000000000001';

select is((select count(*)::int from t_fixtures), 0, 'no schedule while the mercato is open');

select setseed(0.432);
update manager_leagues set mercato_closed_at = now()
where id in ('1a432000-0000-0000-0000-000000000001', '1a432000-0000-0000-0000-000000000002');

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
  (select array_agg(competition_id order by round)
   from (select distinct round, competition_id from t_fixtures) d where round <= 3),
  array[pg_temp.competition(1), pg_temp.competition(2), pg_temp.competition(3)],
  'one eligible competition per matchday, first one first');
select is((select count(*)::int from t_fixtures where round > 3 and competition_id is null), 6,
  'the matchdays beyond the last competition have none');
select is(
  (select count(*)::int from manager_fixtures
   where league_id = '1a432000-0000-0000-0000-000000000002'),
  0, 'no schedule with an odd number of participants');

create temp table t_before as select * from t_fixtures;
select is(private.schedule_manager_season('1a432000-0000-0000-0000-000000000001'), 0,
  'drawing again writes nothing');
select set_eq('select league_id, round, competition_id, home_id, away_id from t_fixtures',
  'select league_id, round, competition_id, home_id, away_id from t_before',
  'the schedule never changes');

grant select on t_fixtures to authenticated;
set local role authenticated;
select pg_temp.as_player(2);
select is((select count(*)::int from manager_fixtures), 12,
  'a participant reads the schedule of their league');
select throws_ok(
  $$delete from manager_fixtures where league_id = '1a432000-0000-0000-0000-000000000001'$$,
  '42501', null, 'a participant does not change it');
select pg_temp.as_player(8);
select is((select count(*)::int from manager_fixtures), 0,
  'a player outside the league does not read it');
reset role;

select * from finish();
rollback;
