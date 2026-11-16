-- pgTAP: the match sheet of a Manager lineup (#1032). One place per family, a bench of 4.
--   c1 open, c2 locked (its event has started).
--   Player 1, all entered in c1 (a6 by the back-office, without a start list):
--     a1 F 100 m (on the 100 m and 200 m start lists)   a2 M 100 m        a3 F 100 m haies
--     a4 F 800 m                                         a5 M 1500 m
--     a6 F long jump (profile: long jump only)           a10 M triple jump
--     a7 M shot put                                      a8 M discus
--     a9 F 5000 m, entered nowhere.
--   Player 2: a11 M 100 m.
-- Starters a1, a4, a6, a7; the bench is made of a2, a3, a5, a8 (and a10). Rolled back at the end.
begin;
select plan(26);

insert into auth.users (id, email) values
  ('5ee00000-0000-0000-0000-000000000001', 'sheet-one@example.test'),
  ('5ee00000-0000-0000-0000-000000000002', 'sheet-two@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('5ee00000-0000-0000-0000-000000000001', 'Feuille Une', now()),
  ('5ee00000-0000-0000-0000-000000000002', 'Feuille Deux', now());

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('5ee00000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.competition(p_n int) returns uuid language sql immutable as $$
  select ('5ee00000-0000-0000-0000-0000000000c' || p_n)::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select '5ee00000-0000-0000-0000-0000000000f1'::uuid
$$;
grant execute on function pg_temp.athlete(int), pg_temp.competition(int), pg_temp.league()
  to authenticated;

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'sheet-' || n, 'Sheet Athlete ' || n, 'FRA', sex
from (values (1, 'F'), (2, 'M'), (3, 'F'), (4, 'F'), (5, 'M'), (6, 'F'), (7, 'M'), (8, 'M'),
             (9, 'F'), (10, 'M'), (11, 'M')) as t(n, sex);
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select pg_temp.athlete(n), discipline, true
from (values (1, '100 m'), (2, '100 m'), (3, '100 m haies'), (4, '800 m'), (5, '1500 m'),
             (6, 'Saut en longueur'), (7, 'Lancer du poids'), (8, 'Lancer du disque'),
             (9, '5000 m'), (10, 'Triple saut'), (11, '100 m')) as t(n, discipline);

insert into competitions (id, slug, name, starts_on, ends_on)
select pg_temp.competition(n), 'sheet-c' || n, 'Sheet Meeting ' || n, current_date + days,
       current_date + days
from (values (1, 3), (2, 0)) as t(n, days);
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.competition(c), 'sheet-e' || c || '-' || k, discipline, gender, lock_at, lock_at
from (values
  (1, 1, '100 m', 'F', now() + interval '2 days'), (1, 2, '200 m', 'F', now() + interval '2 days'),
  (1, 3, '100 m', 'M', now() + interval '2 days'),
  (1, 4, '100 m haies', 'F', now() + interval '2 days'),
  (1, 5, '800 m', 'F', now() + interval '2 days'), (1, 6, '1500 m', 'M', now() + interval '2 days'),
  (1, 7, 'Lancer du poids', 'M', now() + interval '2 days'),
  (1, 8, 'Lancer du disque', 'M', now() + interval '2 days'),
  (1, 9, 'Triple saut', 'M', now() + interval '2 days'),
  (2, 1, '100 m', 'F', now() - interval '1 hour')) as t(c, k, discipline, gender, lock_at);
insert into entries (event_id, athlete_id)
select e.id, pg_temp.athlete(a)
from events e,
     (values (1, 1, 1), (1, 2, 1), (1, 3, 2), (1, 3, 11), (1, 4, 3), (1, 5, 4), (1, 6, 5),
             (1, 7, 7), (1, 8, 8), (1, 9, 10), (2, 1, 1)) as t(c, k, a)
where e.slug = 'sheet-e' || t.c || '-' || t.k;
-- a6 is entered by the back-office, on no start list.
insert into competition_athletes (competition_id, athlete_id)
values (pg_temp.competition(1), pg_temp.athlete(6));

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at)
values (pg_temp.league(), 'Feuille de match', '5ee00000-0000-0000-0000-000000000001',
        '{"budget": 100, "minTeamSize": 8, "quotas": [],
          "lineup": {"max": 4, "perFamily": 1, "bench": 4}}',
        array[pg_temp.competition(1), pg_temp.competition(2)],
        now() - interval '3 days', now() - interval '1 day');
insert into manager_members (league_id, user_id) values
  (pg_temp.league(), '5ee00000-0000-0000-0000-000000000001'),
  (pg_temp.league(), '5ee00000-0000-0000-0000-000000000002');
insert into manager_rounds (league_id, round, ends_at) values (pg_temp.league(), 1, now());
insert into manager_awards (league_id, athlete_id, user_id, amount, round)
select pg_temp.league(), pg_temp.athlete(a), ('5ee00000-0000-0000-0000-00000000000' || p)::uuid,
       5, 1
from (values (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1), (10, 1),
             (11, 2)) as t(a, p);

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    '5ee00000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

-- `save_manager_lineup` with a sheet whose athletes and substitutes are given by number: the
-- starters a1, a4, a6, a7 by default, each with the fields of `p_first` for a1, then `p_bench`.
create function pg_temp.save(p_competition int, p_sheet jsonb) returns text
language sql as $$
  select format('select save_manager_lineup(%L, %L, %L)', pg_temp.league(),
    pg_temp.competition(p_competition),
    jsonb_build_object(
      'starters', coalesce((
        select jsonb_agg(x || jsonb_build_object('athlete', pg_temp.athlete((x ->> 'athlete')::int))
                         || case when x ? 'substitute' and x ->> 'substitute' is not null
                                 then jsonb_build_object('substitute',
                                        pg_temp.athlete((x ->> 'substitute')::int))
                                 else '{}'::jsonb end
                         order by n)
        from jsonb_array_elements(p_sheet -> 'starters') with ordinality s(x, n)), '[]'),
      'bench', coalesce((
        select jsonb_agg(x || jsonb_build_object('athlete', pg_temp.athlete((x ->> 'athlete')::int))
                         order by n)
        from jsonb_array_elements(coalesce(p_sheet -> 'bench', '[]')) with ordinality b(x, n)),
        '[]')))
$$;
create function pg_temp.sheet(p_first jsonb, p_bench int[] default '{}', p_more jsonb default '[]')
returns jsonb language sql as $$
  select jsonb_build_object(
    'starters', jsonb_build_array(jsonb_build_object('athlete', 1) || p_first,
                                  jsonb_build_object('athlete', 4),
                                  jsonb_build_object('athlete', 6),
                                  jsonb_build_object('athlete', 7)) || p_more,
    'bench', coalesce((select jsonb_agg(jsonb_build_object('athlete', b) order by o)
                       from unnest(p_bench) with ordinality u(b, o)), '[]'))
$$;
grant execute on function pg_temp.save(int, jsonb), pg_temp.sheet(jsonb, int[], jsonb)
  to authenticated;

set local role authenticated;
select pg_temp.as_player(1);

-- A full sheet: four starters, four ordered substitutes, a designated substitute and a threshold.
select lives_ok(pg_temp.save(1, pg_temp.sheet(
    '{"discipline": "200 m", "substitute": 3, "threshold": 20.8}', array[2, 3, 5, 8])),
  'a sheet with an ordered bench, a designated substitute and a threshold is validated');
select results_eq(
  $$select athlete_id, role, slot, discipline, substitute_id, threshold
    from manager_lineup_entries order by role, slot$$,
  $$values (pg_temp.athlete(1), 'starter', 1, '200 m', pg_temp.athlete(3), 20.8::numeric),
           (pg_temp.athlete(4), 'starter', 2, '800 m', null::uuid, null::numeric),
           (pg_temp.athlete(6), 'starter', 3, 'Saut en longueur', null, null),
           (pg_temp.athlete(7), 'starter', 4, 'Lancer du poids', null, null),
           (pg_temp.athlete(2), 'substitute', 1, '100 m', null, null),
           (pg_temp.athlete(3), 'substitute', 2, '100 m haies', null, null),
           (pg_temp.athlete(5), 'substitute', 3, '1500 m', null, null),
           (pg_temp.athlete(8), 'substitute', 4, 'Lancer du disque', null, null)$$,
  'the player reads their sheet: roles, order, disciplines, substitute and threshold');
select is((select athlete_ids from manager_lineups where competition_id = pg_temp.competition(1)),
          array[pg_temp.athlete(1), pg_temp.athlete(4), pg_temp.athlete(6), pg_temp.athlete(7)],
          'the lineup keeps its starters in place order');

select lives_ok(pg_temp.save(1, pg_temp.sheet('{}', array[5])), '…and changes it until the lock');
select results_eq(
  $$select athlete_id, discipline from manager_lineup_entries order by role, slot$$,
  $$values (pg_temp.athlete(1), '100 m'), (pg_temp.athlete(4), '800 m'),
           (pg_temp.athlete(6), 'Saut en longueur'), (pg_temp.athlete(7), 'Lancer du poids'),
           (pg_temp.athlete(5), '1500 m')$$,
  'the last sheet replaces the previous one; without a choice, the main discipline counts');

-- The bench.
select throws_ok(pg_temp.save(1, pg_temp.sheet('{}', array[2, 3, 5, 8, 10])), 'FT041', null,
  'a fifth substitute is refused');
select throws_ok(pg_temp.save(1, pg_temp.sheet('{}', array[9])), 'FT024', null,
  'a substitute not entered in the competition is refused');
select throws_ok(pg_temp.save(1, pg_temp.sheet('{}', array[11])), 'FT024', null,
  'a substitute of another team is refused');
select throws_ok(pg_temp.save(1, pg_temp.sheet('{}', array[1])), 'FT024', null,
  'a starter on the bench as well is refused');

-- The discipline that counts.
select throws_ok(pg_temp.save(1, pg_temp.sheet('{"discipline": "400 m"}')), 'FT036', null,
  'a discipline where the athlete is not on a start list is refused');
select throws_ok(pg_temp.save(1, pg_temp.sheet('{"discipline": "Lancer du poids"}')), 'FT036',
  null, 'a discipline of another athlete is refused');
select throws_ok(pg_temp.save(1, jsonb_build_object(
    'starters', jsonb_build_array(jsonb_build_object('athlete', 1), jsonb_build_object('athlete', 4),
                                  jsonb_build_object('athlete', 6, 'discipline', 'Triple saut'),
                                  jsonb_build_object('athlete', 7)))), 'FT036', null,
  'without a start list, a discipline that is not on their profile is refused');
select throws_ok(pg_temp.save(1, pg_temp.sheet('{}', '{}', '[]') || jsonb_build_object(
    'bench', jsonb_build_array(jsonb_build_object('athlete', 2, 'discipline', '800 m')))),
  'FT036', null, 'a substitute in a discipline they are not entered in is refused');

-- The designated substitute.
select throws_ok(pg_temp.save(1, pg_temp.sheet('{"substitute": 5}', array[5])), 'FT037', null,
  'a designated substitute of another family is refused');
select lives_ok(pg_temp.save(1, pg_temp.sheet('{"substitute": 2}', array[2])),
  'a designated substitute of the family is accepted, a man for a woman');
select throws_ok(pg_temp.save(1, pg_temp.sheet('{"substitute": 2}', array[3])), 'FT038', null,
  'a designated substitute in reserve is refused');
select throws_ok(pg_temp.save(1, jsonb_build_object(
    'starters', jsonb_build_array(jsonb_build_object('athlete', 1),
                                  jsonb_build_object('athlete', 4, 'substitute', 5),
                                  jsonb_build_object('athlete', 6),
                                  jsonb_build_object('athlete', 7, 'substitute', 5)),
    'bench', jsonb_build_array(jsonb_build_object('athlete', 5)))), 'FT037', null,
  'a substitute of another family for a thrower is refused');
reset role;
update manager_leagues set rules = jsonb_set(rules, '{lineup}',
  '{"max": 8, "perFamily": 2, "bench": 4}') where id = pg_temp.league();
set local role authenticated;
select throws_ok(pg_temp.save(1, jsonb_build_object(
    'starters', jsonb_build_array(jsonb_build_object('athlete', 1, 'substitute', 2),
                                  jsonb_build_object('athlete', 3, 'substitute', 2),
                                  jsonb_build_object('athlete', 4), jsonb_build_object('athlete', 5),
                                  jsonb_build_object('athlete', 6), jsonb_build_object('athlete', 10),
                                  jsonb_build_object('athlete', 7), jsonb_build_object('athlete', 8)),
    'bench', jsonb_build_array(jsonb_build_object('athlete', 2)))), 'FT039', null,
  'the same substitute for two starters is refused');
reset role;
update manager_leagues set rules = jsonb_set(rules, '{lineup}',
  '{"max": 4, "perFamily": 1, "bench": 4}') where id = pg_temp.league();
set local role authenticated;

-- The tactical threshold.
select throws_ok(pg_temp.save(1, pg_temp.sheet('{"substitute": 2, "threshold": 8}', array[2])),
  'FT040', null, 'a threshold no 100 m runner can run is refused');
select throws_ok(pg_temp.save(1, pg_temp.sheet('{"substitute": 2, "threshold": "fast"}',
                                               array[2])),
  'FT040', null, 'a threshold that is not a number is refused');
select throws_ok(pg_temp.save(1, pg_temp.sheet('{"threshold": 10.5}', array[2])), 'FT042', null,
  'a threshold without a designated substitute is refused');

-- Only the database writes, and never after the lock; each player reads their own sheet.
select throws_ok($$delete from manager_lineup_entries$$, '42501', null,
  'a player does not change a sheet by hand');
select throws_ok(pg_temp.save(2, jsonb_build_object(
    'starters', jsonb_build_array(jsonb_build_object('athlete', 1)))), 'FT023', null,
  'no sheet once the competition has started');
select pg_temp.as_player(2);
select is((select count(*) from manager_lineup_entries)::int, 0,
  'a participant does not read the sheets of the others');
reset role;

update events set lock_at = now() - interval '1 minute', starts_at = now() - interval '1 minute'
where competition_id = pg_temp.competition(1);
select throws_ok($$update manager_lineup_entries set threshold = null
                   where competition_id = pg_temp.competition(1)$$, 'FT023', null,
  'the database refuses any change of a sheet after the lock');
select is((select count(*) from manager_lineup_entries
           where competition_id = pg_temp.competition(1))::int, 5, 'the locked sheet is kept');

select * from finish();
rollback;
