-- pgTAP: the lineup before each eligible competition (#427). The stadium of the league has 3
-- places: one sprint (hurdles count as sprint), one middle distance, one free. A lineup holds
-- athletes of the player's team, each once, entered in the competition, and fills every place the
-- team can fill; it locks at the first prediction lock of the competition.
--   c1 open, c2 locked (its event has started), c3 not eligible, c4 open, nobody entered.
--   Player 1: a1 sprint, a2 hurdles, a3 middle (in c1), a4 thrower (in c1), a5 long (in no
--   competition). Player 2: a6 sprint. Player 3: not in the league.
-- Rolled back at the end.
begin;
select plan(23);

insert into auth.users (id, email) values
  ('a1e00000-0000-0000-0000-000000000001', 'one@example.test'),
  ('a1e00000-0000-0000-0000-000000000002', 'two@example.test'),
  ('a1e00000-0000-0000-0000-000000000003', 'three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('a1e00000-0000-0000-0000-000000000001', 'Align Une', now()),
  ('a1e00000-0000-0000-0000-000000000002', 'Align Deux', now()),
  ('a1e00000-0000-0000-0000-000000000003', 'Align Trois', now());
-- The Manager is open to the admins only (#615): its players here are admins.
update profiles set is_admin = true where id::text like 'a1e00000-%';

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('a1e00000-0000-0000-0000-0000000000a' || p_n)::uuid
$$;
create function pg_temp.competition(p_n int) returns uuid language sql immutable as $$
  select ('a1e00000-0000-0000-0000-0000000000c' || p_n)::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select 'a1e00000-0000-0000-0000-0000000000f1'::uuid
$$;
grant execute on function pg_temp.athlete(int), pg_temp.competition(int), pg_temp.league()
  to authenticated;

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'align-' || n, 'Align Athlete ' || n, 'FRA', sex
from (values (1, 'F'), (2, 'F'), (3, 'F'), (4, 'M'), (5, 'F'), (6, 'M')) as t(n, sex);
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select pg_temp.athlete(n), discipline, true
from (values (1, '100 m'), (2, '100 m haies'), (3, '800 m'), (4, 'Lancer du poids'),
             (5, '5000 m'), (6, '100 m')) as t(n, discipline);

insert into competitions (id, slug, name, starts_on, ends_on)
select pg_temp.competition(n), 'align-c' || n, 'Align Meeting ' || n, current_date + days,
       current_date + days
from (values (1, 3), (2, 0), (3, 3), (4, 3)) as t(n, days);
-- c1 opens in 2 days, c2 locked an hour ago; c3 has the same entries as c1.
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.competition(n), 'align-e' || n, '100 m', 'F', lock_at, lock_at
from (values (1, now() + interval '2 days'), (2, now() - interval '1 hour'),
             (3, now() + interval '2 days')) as t(n, lock_at);
insert into entries (event_id, athlete_id)
select e.id, pg_temp.athlete(a)
from events e,
     (values (1, 1), (1, 2), (1, 3), (1, 4), (1, 6), (2, 1), (2, 3), (3, 1)) as t(c, a)
where e.slug = 'align-e' || t.c and e.competition_id = pg_temp.competition(t.c);

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at)
values (pg_temp.league(), 'Alignement', 'a1e00000-0000-0000-0000-000000000001',
        '{"budget": 100, "minTeamSize": 6, "quotas": [],
          "lineup": {"max": 3, "minPerFamily": {"hurdles": 1, "middle": 1}}}',
        array[pg_temp.competition(1), pg_temp.competition(2), pg_temp.competition(4)],
        now() - interval '3 days', now() - interval '1 day');
insert into manager_members (league_id, user_id) values
  (pg_temp.league(), 'a1e00000-0000-0000-0000-000000000001'),
  (pg_temp.league(), 'a1e00000-0000-0000-0000-000000000002');
insert into manager_rounds (league_id, round, ends_at) values (pg_temp.league(), 1, now());
insert into manager_awards (league_id, athlete_id, user_id, amount, round)
select pg_temp.league(), pg_temp.athlete(a), ('a1e00000-0000-0000-0000-00000000000' || p)::uuid,
       10, 1
from (values (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 2)) as t(a, p);

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a1e00000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

-- `save_manager_lineup` for player 1 in c1 with these athletes.
create function pg_temp.save(p_competition int, p_athletes int[]) returns text
language sql as $$
  select format('select save_manager_lineup(%L, %L, %L)', pg_temp.league(),
                pg_temp.competition(p_competition),
                (select coalesce(array_agg(pg_temp.athlete(a) order by o), '{}')
                 from unnest(p_athletes) with ordinality u(a, o)))
$$;
grant execute on function pg_temp.save(int, int[]) to authenticated;

set local role authenticated;
select pg_temp.as_player(1);

-- Quotas, the maximum and the compatibility.
select throws_ok(pg_temp.save(1, array[1, 3]), 'FT024', null,
  'a lineup that leaves a place it could fill empty is refused');
select throws_ok(pg_temp.save(1, array[3, 4]), 'FT024', null,
  'a lineup without a sprinter, when one is entered, is refused');
select throws_ok(pg_temp.save(1, array[1, 2, 3, 4]), 'FT024', null,
  'a lineup over the maximum is refused');
select throws_ok(pg_temp.save(1, array[1, 1, 3]), 'FT024', null,
  'the same athlete twice is refused');
select throws_ok(pg_temp.save(1, array[1, 3, 6]), 'FT024', null,
  'an athlete of another team is refused');
select throws_ok(pg_temp.save(1, array[1, 3, 5]), 'FT024', null,
  'an athlete not entered in the competition is refused');

select lives_ok(pg_temp.save(1, array[2, 3, 4]), 'a lineup that fills every place is validated');
select is((select athlete_ids from manager_lineups
           where competition_id = pg_temp.competition(1)),
          array[pg_temp.athlete(2), pg_temp.athlete(3), pg_temp.athlete(4)],
          'the player reads the lineup they validated');
select lives_ok(pg_temp.save(1, array[1, 3, 2]), '…and changes it until the lock');
select is((select athlete_ids from manager_lineups
           where competition_id = pg_temp.competition(1)),
          array[pg_temp.athlete(1), pg_temp.athlete(3), pg_temp.athlete(2)],
          'the last lineup counts');

-- An incomplete team: a place nobody can fill does not stop the lineup.
select lives_ok(pg_temp.save(4, array[]::int[]),
  'with nobody entered, an empty lineup is the full one');

-- Only the database writes, and never after the lock.
select throws_ok($$update manager_lineups set athlete_ids = '{}'$$, '42501', null,
  'a player does not change a lineup by hand…');
select throws_ok($$insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
                   values (pg_temp.league(), pg_temp.competition(2),
                           'a1e00000-0000-0000-0000-000000000001', '{}')$$, '42501', null,
  '…nor writes one');
select throws_ok(pg_temp.save(2, array[1, 3]), 'FT023', null,
  'no lineup once the competition has started');
select throws_ok(pg_temp.save(3, array[1]), 'P0002', null,
  'no lineup for a competition the league does not play');

-- Another participant does not see it; an outsider has no lineup.
select pg_temp.as_player(2);
select is((select count(*) from manager_lineups)::int, 0,
  'a participant does not read the lineups of the others');
select is((select entered from my_manager_lineups(pg_temp.league())
           where competition_id = pg_temp.competition(1)),
          array[pg_temp.athlete(6)], 'a participant reads which of their athletes are entered');
select pg_temp.as_player(3);
select throws_ok(pg_temp.save(1, array[1]), '42501', null, 'an outsider has no lineup');
select throws_ok($$select * from my_manager_lineups(pg_temp.league())$$, '42501', null,
  'an outsider reads no lineup');

select pg_temp.as_player(1);
select results_eq(
  $$select slug, athlete_ids is not null, lock_at = now() - interval '1 hour'
    from my_manager_lineups(pg_temp.league())$$,
  $$values ('align-c2', false, true), ('align-c1', true, false), ('align-c4', true, false)$$,
  'the player reads the eligible competitions, first one first, with their lock and lineup');
reset role;

-- The lock holds even for a write that skips the function: move the lock of c1 back.
update events set lock_at = now() - interval '1 minute', starts_at = now() - interval '1 minute'
where competition_id = pg_temp.competition(1);
select throws_ok($$update manager_lineups set athlete_ids = '{}'
                   where competition_id = pg_temp.competition(1)$$, 'FT023', null,
  'the database refuses any change of a lineup after the lock');
select is((select cardinality(athlete_ids) from manager_lineups
           where competition_id = pg_temp.competition(1)), 3, 'the locked lineup is kept');
select lives_ok($$delete from manager_leagues where id = pg_temp.league()$$,
  'a league with locked lineups can still be deleted');

select * from finish();
rollback;
