-- pgTAP: the jokers of a Manager league (#1091). Once in the season, one per head-to-head, before
-- the lock of the lineup; never on a bonus matchday; « Avantage terrain » at home only; the target
-- fits the joker; the opponent sees it from the lock; « Coaching » after the lock, once, before the
-- starter's event.
--   Matchdays: 1 c1 open (player 1 at home), 2 c2 locked an hour ago (player 2 at home), 3 c4 open
--   (player 1 at home), 4 c3 bonus. Player 1's team: a1, a2, a5, a6 (100 m), player 2's: a3, a4.
--   c2: the 100 m starts in 2 hours, the 200 m started 30 minutes ago.
-- Rolled back at the end.
begin;
select plan(26);

insert into auth.users (id, email) values
  ('d0e20000-0000-0000-0000-000000000001', 'one@example.test'),
  ('d0e20000-0000-0000-0000-000000000002', 'two@example.test'),
  ('d0e20000-0000-0000-0000-000000000003', 'three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('d0e20000-0000-0000-0000-000000000001', 'Joker Une', now()),
  ('d0e20000-0000-0000-0000-000000000002', 'Joker Deux', now()),
  ('d0e20000-0000-0000-0000-000000000003', 'Joker Trois', now());

create function pg_temp.competition(p_n int) returns uuid language sql immutable as $$
  select ('d0e20000-0000-0000-0000-0000000000c' || p_n)::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select 'd0e20000-0000-0000-0000-0000000000f1'::uuid
$$;
create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('d0e20000-0000-0000-0000-0000000000a' || p_n)::uuid
$$;
create function pg_temp.player(p_n int) returns uuid language sql immutable as $$
  select ('d0e20000-0000-0000-0000-00000000000' || p_n)::uuid
$$;
grant execute on function pg_temp.competition(int), pg_temp.league(), pg_temp.athlete(int),
  pg_temp.player(int) to authenticated, anon;

insert into competitions (id, slug, name, starts_on, ends_on)
select pg_temp.competition(n), 'joker-c' || n, 'Joker Meeting ' || n, current_date + days,
       current_date + days
from (values (1, 3), (2, 0), (3, 5), (4, 4)) as t(n, days);
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.competition(n), 'joker-e' || n || '-' || slug, discipline, 'F', starts_at, lock_at
from (values (1, '100', '100 m', now() + interval '2 days', now() + interval '2 days'),
             (2, '100', '100 m', now() + interval '2 hours', now() - interval '1 hour'),
             (2, '200', '200 m', now() - interval '30 minutes', now() - interval '1 hour'),
             (3, '100', '100 m', now() + interval '5 days', now() + interval '5 days'),
             (4, '100', '100 m', now() + interval '4 days', now() + interval '4 days'))
  as t(n, slug, discipline, starts_at, lock_at);

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'joker-' || n, 'Joker Athlete ' || n, 'FRA', 'F'
from generate_series(1, 6) as n;
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select pg_temp.athlete(n), '100 m', true from generate_series(1, 6) as n;
insert into athlete_disciplines (athlete_id, discipline, is_primary)
values (pg_temp.athlete(6), '200 m', false);

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at)
values (pg_temp.league(), 'Jokers', pg_temp.player(1), '{}',
        array[pg_temp.competition(1), pg_temp.competition(2), pg_temp.competition(4),
              pg_temp.competition(3)],
        now() - interval '3 days', now() - interval '1 day');
insert into manager_members (league_id, user_id) values
  (pg_temp.league(), pg_temp.player(1)),
  (pg_temp.league(), pg_temp.player(2));
insert into manager_rounds (league_id, round, ends_at) values (pg_temp.league(), 1, now());
insert into manager_awards (league_id, athlete_id, user_id, amount, round)
select pg_temp.league(), pg_temp.athlete(a), pg_temp.player(p), 10, 1
from (values (1, 1), (2, 1), (5, 1), (6, 1), (3, 2), (4, 2)) as t(a, p);

insert into manager_matchdays (league_id, round, competition_id, bonus) values
  (pg_temp.league(), 1, pg_temp.competition(1), false),
  (pg_temp.league(), 2, pg_temp.competition(2), false),
  (pg_temp.league(), 3, pg_temp.competition(4), false),
  (pg_temp.league(), 4, pg_temp.competition(3), true);
insert into manager_fixtures (league_id, round, home_id, away_id) values
  (pg_temp.league(), 1, pg_temp.player(1), pg_temp.player(2)),
  (pg_temp.league(), 2, pg_temp.player(2), pg_temp.player(1)),
  (pg_temp.league(), 3, pg_temp.player(1), pg_temp.player(2));

-- The lineups were validated before the lock: the lock trigger is set aside to write them here.
alter table manager_lineups disable trigger trg_manager_lineup_lock;
insert into manager_lineups (league_id, competition_id, user_id, athlete_ids) values
  (pg_temp.league(), pg_temp.competition(2), pg_temp.player(1),
   array[pg_temp.athlete(1), pg_temp.athlete(2)]),
  (pg_temp.league(), pg_temp.competition(4), pg_temp.player(2), array[pg_temp.athlete(3)]);
alter table manager_lineups enable trigger trg_manager_lineup_lock;
-- Player 1 chose the coaching for c2 before the lock.
insert into manager_joker_plays (league_id, user_id, competition_id, kind) values
  (pg_temp.league(), pg_temp.player(1), pg_temp.competition(2), 'coaching');

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'd0e20000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

select is((select array_agg(kind order by kind) from manager_league_jokers
           where league_id = pg_temp.league()),
  array['captain', 'coaching', 'extended_bench', 'false_start', 'home_advantage'],
  'a new Manager league receives the active Manager jokers of the catalogue');

set local role authenticated;
select pg_temp.as_player(1);

select is(manager_joker_duel(pg_temp.league(), pg_temp.competition(1)) - 'opponent_team',
  jsonb_build_object('home', true, 'opponent_id', pg_temp.player(2)),
  'the player reads their head-to-head of the matchday: at home against player 2');
select is(manager_joker_duel(pg_temp.league(), pg_temp.competition(3)), null,
  '…and none on a bonus matchday');

select lives_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(1),
         'captain', pg_temp.athlete(1)),
  'a player makes an athlete of their team captain of a head-to-head');
select throws_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(4),
         'captain', pg_temp.athlete(2)),
  'FT045', null, 'the same joker cannot be played on a second matchday of the season');
select throws_ok(
  format('select play_manager_joker(%L, %L, %L)', pg_temp.league(), pg_temp.competition(3),
         'home_advantage'),
  'FT048', null, 'no joker on a bonus matchday');
select throws_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(2),
         'false_start', pg_temp.athlete(3)),
  'FT023', null, 'no joker once the lineup is locked');
select lives_ok(
  format('select play_manager_joker(%L, %L, %L)', pg_temp.league(), pg_temp.competition(1),
         'home_advantage'),
  'another joker on the same matchday replaces the first one');
select is((select array_agg(kind) from manager_joker_plays
           where competition_id = pg_temp.competition(1) and user_id = pg_temp.player(1)),
  array['home_advantage'], '…one joker per head-to-head');
select lives_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(4),
         'captain', pg_temp.athlete(2)),
  '…and the captain is back in the hand for another matchday');
select throws_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(1),
         'captain', pg_temp.athlete(3)),
  'FT045', null, 'the captain is an athlete of the player''s team… once in the season');

select pg_temp.as_player(2);
select throws_ok(
  format('select play_manager_joker(%L, %L, %L)', pg_temp.league(), pg_temp.competition(1),
         'home_advantage'),
  'FT049', null, 'the home advantage is not played away');
select throws_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(1),
         'false_start', pg_temp.athlete(3)),
  'FT050', null, 'the false start hits an athlete of the opponent, not one of the player''s own');
select lives_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(1),
         'false_start', pg_temp.athlete(1)),
  'a false start on an athlete of the opponent''s team');
select throws_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(4),
         'extended_bench', pg_temp.athlete(3)),
  'FT050', null, 'the 9th starter is not already on the match sheet');
select lives_ok(
  format('select play_manager_joker(%L, %L, %L, %L)', pg_temp.league(), pg_temp.competition(4),
         'extended_bench', pg_temp.athlete(4)),
  'an athlete of the team off the match sheet becomes the 9th starter');
select is((select discipline from manager_joker_plays
           where competition_id = pg_temp.competition(4) and user_id = pg_temp.player(2)),
  '100 m', '…in their first discipline');
select is((select count(*)::int from manager_joker_plays where user_id = pg_temp.player(1)
           and competition_id in (pg_temp.competition(1), pg_temp.competition(4))),
  0, 'before the lock, the opponent does not see the jokers of the matchday');
select is((select kind from manager_joker_plays
           where user_id = pg_temp.player(1) and competition_id = pg_temp.competition(2)),
  'coaching', 'from the lock on, the opponent sees the joker');

select pg_temp.as_player(1);
select throws_ok(
  format('select coach_manager_lineup(%L, %L, %L, %L, %L)', pg_temp.league(),
         pg_temp.competition(2), pg_temp.athlete(1), pg_temp.athlete(6), '200 m'),
  'FT051', null, 'the coached athlete cannot come in for an event already started');
select throws_ok(
  format('select coach_manager_lineup(%L, %L, %L, %L)', pg_temp.league(),
         pg_temp.competition(2), pg_temp.athlete(1), pg_temp.athlete(2)),
  'FT050', null, 'the coached athlete is not already on the match sheet');
select lives_ok(
  format('select coach_manager_lineup(%L, %L, %L, %L)', pg_temp.league(),
         pg_temp.competition(2), pg_temp.athlete(1), pg_temp.athlete(5)),
  'after the lock, the coaching puts an athlete of the same family in a starter''s place');
select throws_ok(
  format('select coach_manager_lineup(%L, %L, %L, %L)', pg_temp.league(),
         pg_temp.competition(2), pg_temp.athlete(2), pg_temp.athlete(6)),
  'FT051', null, 'the coaching is used once');
select lives_ok(
  format('select remove_manager_joker(%L, %L)', pg_temp.league(), pg_temp.competition(1)),
  'before the lock, the player takes back the joker of the matchday');

select pg_temp.as_player(3);
select throws_ok(
  format('select play_manager_joker(%L, %L, %L)', pg_temp.league(), pg_temp.competition(1),
         'home_advantage'),
  '42501', null, 'a player outside the league plays no joker');
reset role;

select throws_ok(
  format($$insert into manager_scores (league_id, competition_id, user_id, lined_up, total,
                                       hungarian, bonus, predictions, jokers)
           values (%L, %L, %L, true, 100, 80, 10, 0, 5)$$,
         pg_temp.league(), pg_temp.competition(2), pg_temp.player(1)),
  '23514', null, 'a stored score is the sum of its parts, the jokers included');

select * from finish();
rollback;
