-- pgTAP: the end of a Manager season and its honours (#434). The season ends once every matchday
-- of the schedule that has a competition is scored, bonus matchdays included; a matchday without
-- competition does not hold it back. The first of the standings is champion (on a full tie, the
-- earliest to join); the final standings, the head-to-heads and the individual figures are
-- frozen once; read by the participants only, written by nobody. Rolled back at the end.
begin;
select plan(16);

insert into auth.users (id, email)
select ('a434a434-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'h' || n || '@example.test'
from generate_series(1, 5) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('a434a434-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Palmares ' || n, now()
from generate_series(1, 5) n;

create function pg_temp.player(p_n int) returns uuid language sql as $$
  select ('a434a434-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'))::uuid
$$;
create function pg_temp.competition(p_n int) returns uuid language sql as $$
  select ('c434c434-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'))::uuid
$$;
create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.player(p_n),
    'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.player(int) to authenticated;
grant execute on function pg_temp.as_player(int) to authenticated;

-- The Manager scores of one matchday, written in one statement as admin_set_manager_scores does:
-- [{player, total, athletes}], the athletes worth their `total` each.
create function pg_temp.matchday(p_league uuid, p_competition int, p_lines jsonb)
returns void language sql as $$
  insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                              bonus, predictions, athletes)
  select p_league, pg_temp.competition(p_competition), pg_temp.player((l ->> 'player')::int), true,
         (l ->> 'total')::int, (l ->> 'total')::int, 0, 0, coalesce(l -> 'athletes', '[]'::jsonb)
  from jsonb_array_elements(p_lines) l
$$;

insert into athletes (id, slug, name, country_code, gender) values
  ('a7434000-0000-0000-0000-000000000001', 'palmares-un', 'Athlete Un', 'FRA', 'F'),
  ('a7434000-0000-0000-0000-000000000002', 'palmares-deux', 'Athlete Deux', 'FRA', 'F');

-- Three competitions a day apart, all after the close of the mercato.
insert into competitions (id, slug, name, starts_on, ends_on)
select pg_temp.competition(n), 'honours-c' || n, 'Palmares ' || n, current_date + n,
       current_date + n
from generate_series(1, 3) n;
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.competition(n), 'honours-100-' || n, '100 m', 'F', now() + n * interval '1 day',
       now() + n * interval '1 day'
from generate_series(1, 3) n;

-- Saison Pleine: 2 players, matchdays 1 and 2 head-to-heads, matchday 3 a bonus one.
-- Saison Courte: 2 players on one competition, matchday 2 without competition (not played).
insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at)
values
  ('1a434000-0000-0000-0000-000000000001', 'Saison Pleine', pg_temp.player(1), '{}',
   array[pg_temp.competition(1), pg_temp.competition(2), pg_temp.competition(3)],
   now() - interval '3 days'),
  ('1a434000-0000-0000-0000-000000000002', 'Saison Courte', pg_temp.player(3), '{}',
   array[pg_temp.competition(1)], now() - interval '3 days');
insert into manager_members (league_id, user_id, joined_at) values
  ('1a434000-0000-0000-0000-000000000001', pg_temp.player(1), now() - interval '2 hours'),
  ('1a434000-0000-0000-0000-000000000001', pg_temp.player(2), now() - interval '1 hour'),
  ('1a434000-0000-0000-0000-000000000002', pg_temp.player(3), now() - interval '1 hour'),
  ('1a434000-0000-0000-0000-000000000002', pg_temp.player(4), now() - interval '2 hours');
update manager_leagues set mercato_closed_at = now()
where id in ('1a434000-0000-0000-0000-000000000001', '1a434000-0000-0000-0000-000000000002');

create temp view t_honours as
select * from manager_honours where league_id = '1a434000-0000-0000-0000-000000000001';

-- Matchday 1: player 1 900 (Athlete Un 900), player 2 700. Matchday 2: 600 – 650.
select pg_temp.matchday('1a434000-0000-0000-0000-000000000001', 1, '[
  {"player": 1, "total": 900, "athletes": [{"athlete_id": "a7434000-0000-0000-0000-000000000001", "total": 900}]},
  {"player": 2, "total": 700}]');
select pg_temp.matchday('1a434000-0000-0000-0000-000000000001', 2, '[
  {"player": 1, "total": 600, "athletes": [{"athlete_id": "a7434000-0000-0000-0000-000000000002", "total": 600}]},
  {"player": 2, "total": 650}]');

select is((select count(*)::int from t_honours), 0,
  'the season goes on while the bonus matchday is not scored');

-- The bonus matchday: player 2 scores 5000, no championship point.
select pg_temp.matchday('1a434000-0000-0000-0000-000000000001', 3, '[
  {"player": 1, "total": 100, "athletes": [{"athlete_id": "a7434000-0000-0000-0000-000000000002", "total": 100}]},
  {"player": 2, "total": 5000}]');

select is((select count(*)::int from t_honours), 1,
  'the season ends after the last matchday of the schedule, bonus matchday included');
select is((select champion_id from t_honours), pg_temp.player(1),
  'the first of the standings is champion');
select is(
  (select array_agg((r ->> 'user_id', (r ->> 'rank')::int, (r ->> 'wins')::int,
                     (r ->> 'losses')::int, (r ->> 'difference')::int, (r ->> 'points')::int)::text
                    order by n)
   from t_honours, jsonb_array_elements(standings) with ordinality as s(r, n)),
  array[(pg_temp.player(1)::text, 1, 1, 1, 150, 3)::text,
        (pg_temp.player(2)::text, 2, 1, 1, -150, 3)::text],
  'the final standings: 3/1/0 then the Manager points difference, the bonus matchday aside');
select is((select jsonb_array_length(duels) from t_honours), 2,
  'the honours keep every head-to-head of the season');
select is(
  (select array_agg((d ->> 'home_score')::int + (d ->> 'away_score')::int order by (d ->> 'round')::int)
   from t_honours, jsonb_array_elements(duels) d),
  array[1600, 1250], 'with the Manager scores of both sides');
select is(
  (select array_agg((p ->> 'manager_points')::int order by p ->> 'user_id')
   from t_honours, jsonb_array_elements(players) p),
  array[1600, 6350], 'the Manager points scored count every matchday, bonus ones included');
select is(
  (select p -> 'best_athlete' ->> 'name' || ' ' || (p -> 'best_athlete' ->> 'points')
   from t_honours, jsonb_array_elements(players) p
   where p ->> 'user_id' = pg_temp.player(1)::text),
  'Athlete Un 900', 'the best athlete is the one who brought the most Manager points');
select is(
  (select p -> 'best_athlete' from t_honours, jsonb_array_elements(players) p
   where p ->> 'user_id' = pg_temp.player(2)::text),
  'null'::jsonb, 'no best athlete without athletes');

-- Scores computed again (#416) after the end: the honours stay frozen.
create temp table t_before as select * from t_honours;
delete from manager_scores
where league_id = '1a434000-0000-0000-0000-000000000001' and competition_id = pg_temp.competition(1);
select pg_temp.matchday('1a434000-0000-0000-0000-000000000001', 1, '[{"player": 1, "total": 100}, {"player": 2, "total": 2000}]');
select is((select standings from t_honours), (select standings from t_before),
  'the final standings are frozen');
select is(private.close_manager_season('1a434000-0000-0000-0000-000000000001'), false,
  'a season ends only once');

-- Saison Courte: one draw, then a matchday without competition.
select pg_temp.matchday('1a434000-0000-0000-0000-000000000002', 1, '[{"player": 3, "total": 500}, {"player": 4, "total": 500}]');
select is(
  (select array_agg((r ->> 'rank')::int) from manager_honours, jsonb_array_elements(standings) r
   where league_id = '1a434000-0000-0000-0000-000000000002'),
  array[1, 1], 'a matchday without competition does not hold the season back; a full tie shares the rank');
select is(
  (select champion_id from manager_honours where league_id = '1a434000-0000-0000-0000-000000000002'),
  pg_temp.player(4), 'on a full tie the earliest to join comes first and is champion');

grant select on t_honours to authenticated;
set local role authenticated;
select pg_temp.as_player(2);
select is((select count(*)::int from t_honours), 1,
  'a participant reads the honours of their league');
select throws_ok(
  $$delete from manager_honours where league_id = '1a434000-0000-0000-0000-000000000001'$$,
  '42501', null, 'a participant does not change them');
select pg_temp.as_player(5);
select is((select count(*)::int from manager_honours
           where league_id = '1a434000-0000-0000-0000-000000000001'), 0,
  'a player outside the league does not read them');
reset role;

select * from finish();
rollback;
