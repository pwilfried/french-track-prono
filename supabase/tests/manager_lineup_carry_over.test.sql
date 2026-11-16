-- pgTAP: a forgotten Manager lineup is carried over from the last one at the lock (#1034).
-- One place per family, a bench of 4.
--   c1 then c2 lock in turn (both locked when the carry-over runs), c3 is still open.
--   Player 1 (team a1 to a8): sheet of c1, nothing for c2.
--     starters a1 F 200 m (on the 100 m and 200 m lists of c1; only on the 100 m one in c2),
--              substitute a2, threshold 20.8
--              a3 F 800 m, a4 F long jump,
--              a5 M shot put (absent from c2), substitute a6
--     bench    a2 M 100 m, a7 M 1500 m (absent from c2), a6 M discus, a8 M triple jump
--   Player 2 (a11): no lineup at all.
--   Player 3 (a12 to a15): a sheet of c1, and their own sheet of c2, validated before the lock.
-- Rolled back at the end.
begin;
select plan(13);

insert into auth.users (id, email)
select ('ca000000-0000-0000-0000-00000000000' || n)::uuid, 'carry-' || n || '@example.test'
from generate_series(1, 3) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('ca000000-0000-0000-0000-00000000000' || n)::uuid, 'Reprise ' || n, now()
from generate_series(1, 3) n;

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('ca000000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.player(p_n int) returns uuid language sql immutable as $$
  select ('ca000000-0000-0000-0000-00000000000' || p_n)::uuid
$$;
create function pg_temp.competition(p_n int) returns uuid language sql immutable as $$
  select ('ca000000-0000-0000-0000-0000000000c' || p_n)::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select 'ca000000-0000-0000-0000-0000000000f1'::uuid
$$;
grant execute on function pg_temp.athlete(int), pg_temp.player(int), pg_temp.competition(int),
  pg_temp.league() to authenticated;

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'carry-' || n, 'Carry Athlete ' || n, 'FRA', sex
from (values (1, 'F'), (2, 'M'), (3, 'F'), (4, 'F'), (5, 'M'), (6, 'M'), (7, 'M'), (8, 'M'),
             (11, 'M'), (12, 'M'), (13, 'F'), (14, 'M'), (15, 'F')) as t(n, sex);
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select pg_temp.athlete(n), discipline, true
from (values (1, '100 m'), (2, '100 m'), (3, '800 m'), (4, 'Saut en longueur'),
             (5, 'Lancer du poids'), (6, 'Lancer du disque'), (7, '1500 m'), (8, 'Triple saut'),
             (11, '100 m'), (12, '100 m'), (13, '800 m'), (14, 'Triple saut'),
             (15, 'Lancer du poids')) as t(n, discipline);

insert into competitions (id, slug, name, starts_on, ends_on)
select pg_temp.competition(n), 'carry-c' || n, 'Carry Meeting ' || n, current_date + n,
       current_date + n
from generate_series(1, 3) n;
-- Every event opens for now: the sheets are saved first, then c1 and c2 lock.
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.competition(c), 'carry-e' || c || '-' || k, discipline, gender,
       now() + interval '2 days', now() + interval '2 days'
from (values
  (1, 1, '100 m', 'F'), (1, 2, '200 m', 'F'), (1, 3, '100 m', 'M'), (1, 4, '800 m', 'F'),
  (1, 5, 'Saut en longueur', 'F'), (1, 6, 'Lancer du poids', 'M'), (1, 7, 'Lancer du disque', 'M'),
  (1, 8, '1500 m', 'M'), (1, 9, 'Triple saut', 'M'), (1, 10, 'Lancer du poids', 'F'),
  (2, 1, '100 m', 'F'), (2, 3, '100 m', 'M'), (2, 4, '800 m', 'F'), (2, 5, 'Saut en longueur', 'F'),
  (2, 7, 'Lancer du disque', 'M'), (2, 9, 'Triple saut', 'M'), (2, 10, 'Lancer du poids', 'F'),
  (3, 1, '100 m', 'F')) as t(c, k, discipline, gender);
insert into entries (event_id, athlete_id)
select e.id, pg_temp.athlete(a)
from events e,
     (values (1, 1, 1), (1, 2, 1), (1, 3, 2), (1, 3, 12), (1, 4, 3), (1, 4, 13), (1, 5, 4),
             (1, 6, 5), (1, 7, 6), (1, 8, 7), (1, 9, 8), (1, 9, 14), (1, 10, 15),
             (2, 1, 1), (2, 3, 2), (2, 3, 12), (2, 4, 3), (2, 4, 13), (2, 5, 4), (2, 7, 6),
             (2, 9, 8), (2, 9, 14), (2, 10, 15), (3, 1, 1)) as t(c, k, a)
where e.slug = 'carry-e' || t.c || '-' || t.k;

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at)
values (pg_temp.league(), 'Reprise', pg_temp.player(1),
        '{"budget": 100, "minTeamSize": 4, "quotas": [],
          "lineup": {"max": 4, "perFamily": 1, "bench": 4}}',
        array[pg_temp.competition(1), pg_temp.competition(2), pg_temp.competition(3)],
        now() - interval '3 days', now() - interval '1 day');
insert into manager_members (league_id, user_id)
select pg_temp.league(), pg_temp.player(n) from generate_series(1, 3) n;
insert into manager_rounds (league_id, round, ends_at) values (pg_temp.league(), 1, now());
insert into manager_awards (league_id, athlete_id, user_id, amount, round)
select pg_temp.league(), pg_temp.athlete(a), pg_temp.player(p), 5, 1
from (values (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (11, 2),
             (12, 3), (13, 3), (14, 3), (15, 3)) as t(a, p);

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.player(p_n),
    'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

set local role authenticated;
select pg_temp.as_player(1);
select save_manager_lineup(pg_temp.league(), pg_temp.competition(1), jsonb_build_object(
  'starters', jsonb_build_array(
    jsonb_build_object('athlete', pg_temp.athlete(1), 'discipline', '200 m',
                       'substitute', pg_temp.athlete(2), 'threshold', 20.8),
    jsonb_build_object('athlete', pg_temp.athlete(3)),
    jsonb_build_object('athlete', pg_temp.athlete(4)),
    jsonb_build_object('athlete', pg_temp.athlete(5), 'substitute', pg_temp.athlete(6))),
  'bench', jsonb_build_array(
    jsonb_build_object('athlete', pg_temp.athlete(2)),
    jsonb_build_object('athlete', pg_temp.athlete(7)),
    jsonb_build_object('athlete', pg_temp.athlete(6)),
    jsonb_build_object('athlete', pg_temp.athlete(8)))));
select pg_temp.as_player(3);
select save_manager_lineup(pg_temp.league(), pg_temp.competition(c), jsonb_build_object(
  'starters', jsonb_build_array(
    jsonb_build_object('athlete', pg_temp.athlete(12)),
    jsonb_build_object('athlete', pg_temp.athlete(13)),
    jsonb_build_object('athlete', pg_temp.athlete(14)),
    jsonb_build_object('athlete', pg_temp.athlete(15)))))
from generate_series(1, 2) c;
reset role;

-- Player 3 validated c2 before its lock; c1 then c2 lock.
update manager_lineups set validated_at = now() - interval '1 day'
where user_id = pg_temp.player(3) and competition_id = pg_temp.competition(2);
update events set lock_at = now() - interval '3 hours', starts_at = now() - interval '3 hours'
where competition_id = pg_temp.competition(1);
update events set lock_at = now() - interval '1 hour', starts_at = now() - interval '1 hour'
where competition_id = pg_temp.competition(2);

select is(private.manager_carry_over_lineups(),
  1, 'one lineup is carried over: player 1 at c2');

select results_eq(
  $$select athlete_id, role, slot, discipline, substitute_id, threshold
    from manager_lineup_entries
    where user_id = pg_temp.player(1) and competition_id = pg_temp.competition(2)
    order by role, slot$$,
  $$values (pg_temp.athlete(1), 'starter', 1, '100 m', pg_temp.athlete(2), null::numeric),
           (pg_temp.athlete(3), 'starter', 2, '800 m', null::uuid, null::numeric),
           (pg_temp.athlete(4), 'starter', 3, 'Saut en longueur', null, null),
           (pg_temp.athlete(6), 'starter', 4, 'Lancer du disque', null, null),
           (pg_temp.athlete(2), 'substitute', 1, '100 m', null, null),
           (pg_temp.athlete(8), 'substitute', 2, 'Triple saut', null, null)$$,
  'the last sheet is copied without the absent athletes: a discipline not on the lists moves '
  'to the one entered (the threshold goes), the designated substitute takes the place of an '
  'absent starter, the bench closes ranks');
select is(
  (select athlete_ids from manager_lineups
   where user_id = pg_temp.player(1) and competition_id = pg_temp.competition(2)),
  array[pg_temp.athlete(1), pg_temp.athlete(3), pg_temp.athlete(4), pg_temp.athlete(6)],
  'the starters of the copy count in place order');
select is(
  (select carried_from from manager_lineups
   where user_id = pg_temp.player(1) and competition_id = pg_temp.competition(2)),
  pg_temp.competition(1), 'the copy says which competition it was taken from');
select is(
  (select carried_from from manager_lineups
   where user_id = pg_temp.player(1) and competition_id = pg_temp.competition(1)),
  null, 'a validated lineup is not marked');

select is_empty(
  $$select 1 from manager_lineups where user_id = pg_temp.player(2)$$,
  'without any previous lineup, nothing is copied: 0 point');

select results_eq(
  $$select athlete_id, carried_from from manager_lineup_entries e
    join manager_lineups ml using (league_id, competition_id, user_id)
    where e.user_id = pg_temp.player(3) and e.competition_id = pg_temp.competition(2)
    order by slot$$,
  $$values (pg_temp.athlete(12), null::uuid), (pg_temp.athlete(13), null),
           (pg_temp.athlete(14), null), (pg_temp.athlete(15), null)$$,
  'a validated lineup is never overwritten');
select ok(
  (select validated_at < now() - interval '1 hour' from manager_lineups
   where user_id = pg_temp.player(3) and competition_id = pg_temp.competition(2)),
  'a validated lineup keeps its validation');

select is_empty(
  $$select 1 from manager_lineups where competition_id = pg_temp.competition(3)$$,
  'nothing is copied before the lock');

-- Once only: run again, after player 1's copy is removed.
delete from manager_lineups
where user_id = pg_temp.player(1) and competition_id = pg_temp.competition(2);
select is(private.manager_carry_over_lineups(), 0, 'a second run copies nothing');
select is_empty(
  $$select 1 from manager_lineups
    where user_id = pg_temp.player(1) and competition_id = pg_temp.competition(2)$$,
  'the copy is made once only');

-- The lock still holds for the players.
set local role authenticated;
select pg_temp.as_player(2);
select throws_ok(
  format('select save_manager_lineup(%L, %L, %L)', pg_temp.league(), pg_temp.competition(2),
    jsonb_build_object('starters', jsonb_build_array(
      jsonb_build_object('athlete', pg_temp.athlete(11))))),
  'FT023', null, 'a player still cannot line up after the lock');
select throws_ok(
  'select private.manager_carry_over_lineups()', '42501', null,
  'a player cannot run the carry-over');
reset role;

select * from finish();
rollback;
