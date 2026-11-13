-- pgTAP: one results sheet per event (#665). Only an admin saves it; the official podium of the
-- predictions is drawn from it (finishers placed 1 to 3, ties included, with their marks); an
-- athlete off the start list is refused. Manager scores stay provisional until every event of the
-- competition has its result, and a season only ends on complete scores.
--   One competition, two events: athletes 1 to 5 on the first start list, 1 to 3 on the second,
--   6 on none. Player 1 is not admin, player 2 is; both play a Manager league on the competition.
-- Rolled back at the end.
begin;
select plan(14);

insert into auth.users (id, email) values
  ('9e665000-0000-0000-0000-000000000001', 'sheet-one@example.test'),
  ('9e665000-0000-0000-0000-000000000002', 'sheet-admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('9e665000-0000-0000-0000-000000000001', 'Feuille Une', now()),
  ('9e665000-0000-0000-0000-000000000002', 'Feuille Admin', now());
update profiles set is_admin = true where id = '9e665000-0000-0000-0000-000000000002';

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('9e665000-0000-0000-0000-0000000000a' || p_n)::uuid
$$;
create function pg_temp.event(p_n int) returns uuid language sql immutable as $$
  select ('9e665000-0000-0000-0000-0000000000e' || p_n)::uuid
$$;
create function pg_temp.competition() returns uuid language sql immutable as $$
  select '9e665000-0000-0000-0000-0000000000c1'::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select '9e665000-0000-0000-0000-0000000000f1'::uuid
$$;
grant execute on function pg_temp.athlete(int), pg_temp.event(int), pg_temp.competition(),
  pg_temp.league() to authenticated;

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'sheet-' || n, 'Sheet Athlete ' || n, 'FRA', 'F'
from generate_series(1, 6) n;
insert into competitions (id, slug, name, starts_on, ends_on) values
  (pg_temp.competition(), 'sheet-c1', 'Sheet Meeting', current_date + 3, current_date + 3);
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.event(n), pg_temp.competition(), 'sheet-e' || n, '100 m', 'F',
       now() + interval '2 days', now() + interval '2 days'
from generate_series(1, 2) n;
insert into entries (event_id, athlete_id)
select pg_temp.event(1), pg_temp.athlete(n) from generate_series(1, 5) n;
insert into entries (event_id, athlete_id)
select pg_temp.event(2), pg_temp.athlete(n) from generate_series(1, 3) n;

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at)
values (pg_temp.league(), 'Feuille', '9e665000-0000-0000-0000-000000000001', '{}',
        array[pg_temp.competition()], now() - interval '3 days');
insert into manager_members (league_id, user_id) values
  (pg_temp.league(), '9e665000-0000-0000-0000-000000000001'),
  (pg_temp.league(), '9e665000-0000-0000-0000-000000000002');
-- Closing the mercato draws the schedule: one head-to-head on the competition.
update manager_leagues set mercato_closed_at = now() where id = pg_temp.league();

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    '9e665000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

create function pg_temp.line(p_n int, p_status text, p_place int, p_mark text)
returns jsonb language sql stable as $$
  select jsonb_build_object('athlete_id', pg_temp.athlete(p_n), 'status', p_status,
    'place', p_place, 'mark', p_mark, 'records', '[]'::jsonb)
$$;
grant execute on function pg_temp.line(int, text, int, text) to authenticated;

-- The podium of an event as 'athlete:rank:mark', athlete 1 first.
create function pg_temp.podium(p_event int) returns text[] language sql stable as $$
  select array_agg(right(athlete_id::text, 1) || ':' || rank || ':' || coalesce(mark, '-')
                   order by athlete_id)
  from results where event_id = pg_temp.event(p_event)
$$;
grant execute on function pg_temp.podium(int) to authenticated;

-- Both players' Manager scores on the competition, as the app sends them.
create function pg_temp.manager_lines() returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_object('league_id', pg_temp.league(),
      'user_id', '9e665000-0000-0000-0000-000000000001', 'lined_up', true, 'total', 900,
      'hungarian', 900, 'bonus', 0, 'predictions', 0),
    jsonb_build_object('league_id', pg_temp.league(),
      'user_id', '9e665000-0000-0000-0000-000000000002', 'lined_up', true, 'total', 700,
      'hungarian', 700, 'bonus', 0, 'predictions', 0))
$$;
grant execute on function pg_temp.manager_lines() to authenticated;

set local role authenticated;

-- A player who is not admin
select pg_temp.as_player(1);

select throws_ok(
  $$select admin_set_performances(pg_temp.event(1), jsonb_build_array(
      pg_temp.line(1, 'ok', 1, '10.62')))$$,
  '42501', null, 'only an admin saves a results sheet');

-- The admin
select pg_temp.as_player(2);

select lives_ok(
  $$select admin_set_performances(pg_temp.event(1), jsonb_build_array(
      pg_temp.line(1, 'ok', 1, '10.62'),
      pg_temp.line(2, 'ok', 1, null),
      pg_temp.line(3, 'ok', 3, '10.80'),
      pg_temp.line(4, 'ok', 4, '10.90'),
      pg_temp.line(5, 'dnf', null, null)))$$,
  'an admin saves a sheet: two tied winners, one of them without a mark, a 4th and a DNF');

select is(pg_temp.podium(1), array['1:1:10.62', '2:1:-', '3:3:10.80'],
  'the podium is drawn from the places 1 to 3, ties and marks included');

select is((select status::text from events where id = pg_temp.event(1)), 'finished',
  'the event with a podium is finished');

select lives_ok(
  $$select admin_set_performances(pg_temp.event(1), jsonb_build_array(
      pg_temp.line(3, 'ok', 1, '10.58'),
      pg_temp.line(1, 'ok', 2, '10.62'),
      pg_temp.line(2, 'dq', null, null),
      pg_temp.line(4, 'ok', 3, '10.90')))$$,
  'an admin corrects the sheet');

select is(pg_temp.podium(1), array['1:2:10.62', '3:1:10.58', '4:3:10.90'],
  'a corrected sheet draws the podium again; a disqualified athlete leaves it');

select throws_ok(
  $$select admin_set_performances(pg_temp.event(1), jsonb_build_array(
      pg_temp.line(6, 'ok', 1, '10.50')))$$,
  '23503', null, 'an athlete off the start list is refused');

select throws_ok(
  $$select admin_set_performances(pg_temp.event(1), jsonb_build_array(
      pg_temp.line(1, 'ok', null, null)))$$,
  '23514', null, 'a finisher with neither a place nor a mark is refused');

select is(pg_temp.podium(1), array['1:2:10.62', '3:1:10.58', '4:3:10.90'],
  'a refused sheet leaves the podium as it was');

-- Manager scores while the second event has no result yet
select lives_ok(
  $$select admin_set_manager_scores(pg_temp.competition(), pg_temp.manager_lines())$$,
  'the Manager is scored after the first sheet');

select is(
  (select array_agg(distinct complete) from manager_scores
   where competition_id = pg_temp.competition()),
  array[false], 'the scores stay provisional while an event of the competition has no result');

select is((select count(*)::int from manager_honours where league_id = pg_temp.league()), 0,
  'provisional scores do not end the season');

-- The last sheet of the competition
select admin_set_performances(pg_temp.event(2), jsonb_build_array(
  pg_temp.line(1, 'ok', 1, null), pg_temp.line(2, 'ok', 2, null), pg_temp.line(3, 'ok', 3, null)));
select admin_set_manager_scores(pg_temp.competition(), pg_temp.manager_lines());

select is(
  (select array_agg(distinct complete) from manager_scores
   where competition_id = pg_temp.competition()),
  array[true], 'the scores are complete once every event of the competition has its result');

select is(
  (select champion_id from manager_honours where league_id = pg_temp.league()),
  '9e665000-0000-0000-0000-000000000001'::uuid,
  'complete scores of the last matchday end the season');

select * from finish();
rollback;
