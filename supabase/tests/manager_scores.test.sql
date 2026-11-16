-- pgTAP: the Manager scores of a competition (#431). Only an admin reads the scoring sheet (the
-- lineups stay private) and writes the scores; a new computation replaces them all; the
-- participants of a league read its scores, nobody else; the parts of a score add up; the
-- predictions no longer count (#1031).
--   One competition, athletes 1 to 3 on its 100 m. A Manager league (mercato closed) with player 1
--   (lined up 1 and 2) and player 2 (no lineup); a league whose mercato is open with player 1;
--   player 3 is in no league; player 4 is admin. Player 1 has 7 prediction points, which the Manager ignores.
--   Their match sheet (#1033): athlete 1 on the 100 m with athlete 3 designated below 10"50,
--   athlete 2 on the 100 m, athlete 3 on the bench; the score applies it (managerCompetitionScore).
-- Rolled back at the end.
begin;
select plan(24);

insert into auth.users (id, email) values
  ('9e500000-0000-0000-0000-000000000001', 'one@example.test'),
  ('9e500000-0000-0000-0000-000000000002', 'two@example.test'),
  ('9e500000-0000-0000-0000-000000000003', 'three@example.test'),
  ('9e500000-0000-0000-0000-000000000004', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('9e500000-0000-0000-0000-000000000001', 'Score Un', now()),
  ('9e500000-0000-0000-0000-000000000002', 'Score Deux', now()),
  ('9e500000-0000-0000-0000-000000000003', 'Score Trois', now()),
  ('9e500000-0000-0000-0000-000000000004', 'Score Admin', now());
update profiles set is_admin = true where id = '9e500000-0000-0000-0000-000000000004';

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('9e500000-0000-0000-0000-0000000000a' || p_n)::uuid
$$;
create function pg_temp.player(p_n int) returns uuid language sql immutable as $$
  select ('9e500000-0000-0000-0000-00000000000' || p_n)::uuid
$$;
create function pg_temp.competition() returns uuid language sql immutable as $$
  select '9e500000-0000-0000-0000-0000000000c1'::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select '9e500000-0000-0000-0000-0000000000f1'::uuid
$$;
grant execute on function pg_temp.athlete(int), pg_temp.player(int), pg_temp.competition(),
  pg_temp.league() to authenticated, anon;

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'score-' || n, 'Score Athlete ' || n, 'FRA', 'F'
from generate_series(1, 3) n;
insert into competitions (id, slug, name, starts_on, ends_on) values
  (pg_temp.competition(), 'score-c1', 'Score Meeting', current_date, current_date);
insert into events (id, competition_id, slug, discipline, gender, round, starts_at, lock_at) values
  ('9e500000-0000-0000-0000-0000000000e1', pg_temp.competition(), 'score-e1', '100 m', 'F',
   'final', now() + interval '1 hour', now() + interval '1 hour');
insert into entries (event_id, athlete_id)
select '9e500000-0000-0000-0000-0000000000e1', pg_temp.athlete(n) from generate_series(1, 3) n;

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at)
values (pg_temp.league(), 'Scores', pg_temp.player(1),
        '{"bonuses": {"first": 50, "personal_best": 20}, "tablesDivisor": 5}', array[pg_temp.competition()],
        now() - interval '3 days', now() - interval '1 day'),
       ('9e500000-0000-0000-0000-0000000000f2', 'Mercato ouvert', pg_temp.player(1),
        '{"bonuses": {}}', array[pg_temp.competition()], now() - interval '1 day', null);
insert into manager_members (league_id, user_id) values
  (pg_temp.league(), pg_temp.player(1)),
  (pg_temp.league(), pg_temp.player(2)),
  ('9e500000-0000-0000-0000-0000000000f2', pg_temp.player(1));
insert into manager_lineups (league_id, competition_id, user_id, athlete_ids) values
  (pg_temp.league(), pg_temp.competition(), pg_temp.player(1),
   array[pg_temp.athlete(1), pg_temp.athlete(2)]);
insert into manager_lineup_entries (league_id, competition_id, user_id, athlete_id, role, slot,
                                    discipline, substitute_id, threshold) values
  (pg_temp.league(), pg_temp.competition(), pg_temp.player(1), pg_temp.athlete(1), 'starter', 1,
   '100 m', pg_temp.athlete(3), 10.50),
  (pg_temp.league(), pg_temp.competition(), pg_temp.player(1), pg_temp.athlete(2), 'starter', 2,
   '100 m', null, null),
  (pg_temp.league(), pg_temp.competition(), pg_temp.player(1), pg_temp.athlete(3), 'substitute', 1,
   '100 m', null, null);

-- The competition starts; the admin enters the performances and the prediction points exist.
update events set starts_at = now() - interval '1 hour', lock_at = now() - interval '1 hour'
where id = '9e500000-0000-0000-0000-0000000000e1';
insert into event_performances (event_id, athlete_id, status, place, mark, records) values
  ('9e500000-0000-0000-0000-0000000000e1', pg_temp.athlete(1), 'ok', 1, '10.90', array['pb']),
  ('9e500000-0000-0000-0000-0000000000e1', pg_temp.athlete(2), 'dnf', null, null, '{}');
insert into score_events (user_id, competition_id, event_id, source, points, reason) values
  (pg_temp.player(1), pg_temp.competition(), '9e500000-0000-0000-0000-0000000000e1',
   'prediction', 7, 'prediction');

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    pg_temp.player(p_n), 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

-- A score line of player n: its parts and one athlete.
create function pg_temp.line(p_n int, p_total int) returns jsonb language sql stable as $$
  select jsonb_build_object('league_id', pg_temp.league(), 'user_id', pg_temp.player(p_n),
    'lined_up', true, 'total', p_total, 'hungarian', p_total - 70, 'bonus', 70,
    'athletes', jsonb_build_array(jsonb_build_object('athlete_id', pg_temp.athlete(1),
      'points', p_total - 70, 'bonus_points', 70, 'total', p_total)))
$$;
create function pg_temp.empty_line(p_n int) returns jsonb language sql stable as $$
  select jsonb_build_object('league_id', pg_temp.league(), 'user_id', pg_temp.player(p_n),
    'lined_up', false, 'total', 0, 'hungarian', 0, 'bonus', 0)
$$;
grant execute on function pg_temp.line(int, int), pg_temp.empty_line(int) to authenticated;

set local role authenticated;

-- The admin reads the sheet
select pg_temp.as_player(4);

select is(
  (select jsonb_array_length(admin_manager_scoring_sheet('score-c1') -> 'participants')),
  2, 'the sheet holds the participants of the leagues whose mercato is over');

select is(
  (select array_agg(s ->> 'athlete_id' order by n) from jsonb_array_elements(
     admin_manager_scoring_sheet('score-c1') -> 'participants') p,
     jsonb_array_elements(p -> 'lineup' -> 'starters') with ordinality s(s, n)
   where p ->> 'user_id' = pg_temp.player(1)::text),
  array[pg_temp.athlete(1)::text, pg_temp.athlete(2)::text],
  'the sheet holds the starters of a participant in place order');

select is(
  (select p -> 'lineup' -> 'starters' -> 0 from jsonb_array_elements(
     admin_manager_scoring_sheet('score-c1') -> 'participants') p
   where p ->> 'user_id' = pg_temp.player(1)::text),
  jsonb_build_object('athlete_id', pg_temp.athlete(1), 'family', 'sprint', 'discipline', '100 m',
                     'substitute_id', pg_temp.athlete(3), 'threshold', 10.50),
  'a starter comes with their discipline, family, designated substitute and threshold');

select is(
  (select p -> 'lineup' -> 'starters' -> 1 ->> 'substitute_id' from jsonb_array_elements(
     admin_manager_scoring_sheet('score-c1') -> 'participants') p
   where p ->> 'user_id' = pg_temp.player(1)::text),
  null, 'a starter without a designated substitute has none');

select is(
  (select p -> 'lineup' -> 'bench' from jsonb_array_elements(
     admin_manager_scoring_sheet('score-c1') -> 'participants') p
   where p ->> 'user_id' = pg_temp.player(1)::text),
  jsonb_build_array(jsonb_build_object('athlete_id', pg_temp.athlete(3), 'family', 'sprint',
                                       'discipline', '100 m')),
  'the sheet holds the bench in rank order, the reserve left out');

select is(
  (select p -> 'lineup' from jsonb_array_elements(
     admin_manager_scoring_sheet('score-c1') -> 'participants') p
   where p ->> 'user_id' = pg_temp.player(2)::text),
  'null'::jsonb,
  'a participant without a lineup has none');

select is(
  (select p -> 'bonuses' -> 'first' from jsonb_array_elements(
     admin_manager_scoring_sheet('score-c1') -> 'participants') p limit 1),
  '50'::jsonb, 'the sheet holds the bonus values frozen in the league');

select is(
  (select array_agg((p ->> 'status') || ':' || (p ->> 'unit') || ':' || (p ->> 'round')
                    order by p ->> 'status' desc)
   from jsonb_array_elements(admin_manager_scoring_sheet('score-c1') -> 'performances') p),
  array['ok:time:final', 'dnf:time:final'],
  'the sheet holds every performance with its unit and round');

select is(
  (select p -> 'tables_divisor' from jsonb_array_elements(
     admin_manager_scoring_sheet('score-c1') -> 'participants') p limit 1),
  '5'::jsonb, 'the sheet holds the divisor of the table points frozen in the league');

select ok(
  not (admin_manager_scoring_sheet('score-c1') ? 'predictions'),
  'the sheet holds no prediction points: they do not count in the Manager');

select ok(
  (admin_manager_scoring_sheet('score-c1') ->> 'lock_at')::timestamptz < now(),
  'the sheet tells when the lineups locked');

select is(admin_manager_scoring_sheet('nope'), null, 'an unknown competition has no sheet');

-- The admin stores the scores
select lives_ok(
  $$select admin_set_manager_scores(pg_temp.competition(),
      jsonb_build_array(pg_temp.line(1, 900), pg_temp.empty_line(2)))$$,
  'an admin stores the scores of the competition');

select is(
  (select count(*)::int from admin_actions where action = 'run_manager_scoring'
     and admin_id = pg_temp.player(4)),
  1, 'the computation is logged');

select lives_ok(
  $$select admin_set_manager_scores(pg_temp.competition(),
      jsonb_build_array(pg_temp.line(1, 800), pg_temp.empty_line(2)))$$,
  'an admin computes again after a correction');

select throws_ok(
  $$select admin_set_manager_scores(pg_temp.competition(), jsonb_build_array(
      pg_temp.line(1, 800) || '{"total": 801}'))$$,
  '23514', null, 'a score whose parts do not add up is refused');

select throws_ok(
  $$select admin_set_manager_scores(pg_temp.competition(), jsonb_build_array(
      pg_temp.empty_line(2) || '{"total": 7, "bonus": 7}'))$$,
  '23514', null, 'without a lineup the score is 0');

select throws_ok(
  $$select admin_set_manager_scores(pg_temp.competition(), jsonb_build_array(
      pg_temp.line(1, 800) || '{"total": 807, "predictions": 7}'))$$,
  '23514', null, 'prediction points no longer add up into a Manager score');

-- A participant
select pg_temp.as_player(1);

select is(
  (select total || ':' || predictions from manager_scores where user_id = pg_temp.player(1)),
  '800:0', 'the prediction part of a stored score is 0');

select is(
  (select total || ':' || (athletes -> 0 ->> 'name')
   from my_manager_score(pg_temp.league(), pg_temp.competition())),
  '800:Score Athlete 1', 'a participant reads their score with the names of their athletes');

select is(
  (select array_agg(total order by user_id) from manager_scores
   where league_id = pg_temp.league()),
  array[800, 0], 'a participant reads the scores of their league, replaced by the new computation');

select throws_ok(
  $$select admin_manager_scoring_sheet('score-c1')$$,
  '42501', null, 'a participant cannot read the lineups of the others');

-- A player outside the league
select pg_temp.as_player(3);

select throws_ok(
  $$select * from my_manager_score(pg_temp.league(), pg_temp.competition())$$,
  '42501', null, 'a player outside the league has no score in it');

select is(
  (select count(*)::int from manager_scores), 0, 'nor reads its scores');

select * from finish();
rollback;
