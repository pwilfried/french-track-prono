-- pgTAP: reading the match sheet of a Manager lineup (#1035). One place per family, a bench of 4.
--   c1 open, eligible; c2 not played by the league.
--   Player 1: a1 F 100 m (on the 100 m and 200 m start lists), a2 M 100 m, a3 F 800 m,
--   a4 F long jump, a5 M shot put, a6 M discus. Player 2: a7 M 100 m. Rolled back at the end.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('5ef00000-0000-0000-0000-000000000001', 'read-one@example.test'),
  ('5ef00000-0000-0000-0000-000000000002', 'read-two@example.test'),
  ('5ef00000-0000-0000-0000-000000000003', 'read-three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('5ef00000-0000-0000-0000-000000000001', 'Lecture Une', now()),
  ('5ef00000-0000-0000-0000-000000000002', 'Lecture Deux', now()),
  ('5ef00000-0000-0000-0000-000000000003', 'Lecture Trois', now());

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('5ef00000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.competition(p_n int) returns uuid language sql immutable as $$
  select ('5ef00000-0000-0000-0000-0000000000c' || p_n)::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select '5ef00000-0000-0000-0000-0000000000f1'::uuid
$$;
create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    '5ef00000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.athlete(int), pg_temp.competition(int), pg_temp.league(),
  pg_temp.as_player(int) to authenticated;

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'read-' || n, 'Read Athlete ' || n, 'FRA', sex
from (values (1, 'F'), (2, 'M'), (3, 'F'), (4, 'F'), (5, 'M'), (6, 'M'), (7, 'M')) as t(n, sex);
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select pg_temp.athlete(n), discipline, true
from (values (1, '100 m'), (2, '100 m'), (3, '800 m'), (4, 'Saut en longueur'),
             (5, 'Lancer du poids'), (6, 'Lancer du disque'), (7, '100 m')) as t(n, discipline);

insert into competitions (id, slug, name, starts_on, ends_on)
select pg_temp.competition(n), 'read-c' || n, 'Read Meeting ' || n, current_date + 3,
       current_date + 3
from generate_series(1, 2) n;
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.competition(1), 'read-e' || k, discipline, gender, now() + interval '2 days',
       now() + interval '2 days'
from (values (1, '100 m', 'F'), (2, '200 m', 'F'), (3, '100 m', 'M'), (4, '800 m', 'F'),
             (5, 'Saut en longueur', 'F'), (6, 'Lancer du poids', 'M'),
             (7, 'Lancer du disque', 'M')) as t(k, discipline, gender);
insert into entries (event_id, athlete_id)
select e.id, pg_temp.athlete(a)
from events e, (values (1, 1), (2, 1), (3, 2), (3, 7), (4, 3), (5, 4), (6, 5), (7, 6)) as t(k, a)
where e.slug = 'read-e' || t.k;

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at)
values (pg_temp.league(), 'Lecture de la feuille', '5ef00000-0000-0000-0000-000000000001',
        '{"budget": 100, "minTeamSize": 8, "quotas": [],
          "lineup": {"max": 4, "perFamily": 1, "bench": 4}}',
        array[pg_temp.competition(1)], now() - interval '3 days', now() - interval '1 day');
insert into manager_members (league_id, user_id) values
  (pg_temp.league(), '5ef00000-0000-0000-0000-000000000001'),
  (pg_temp.league(), '5ef00000-0000-0000-0000-000000000002');
insert into manager_rounds (league_id, round, ends_at) values (pg_temp.league(), 1, now());
insert into manager_awards (league_id, athlete_id, user_id, amount, round)
select pg_temp.league(), pg_temp.athlete(a), ('5ef00000-0000-0000-0000-00000000000' || p)::uuid,
       5, 1
from (values (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 2)) as t(a, p);

set local role authenticated;
select pg_temp.as_player(1);

select is((select count(*) from my_manager_sheet(pg_temp.league(), pg_temp.competition(1))
           where role is null)::int, 6,
  'before any sheet, every athlete of the team is in reserve');
select is((select disciplines from my_manager_sheet(pg_temp.league(), pg_temp.competition(1))
           where athlete_id = pg_temp.athlete(1)),
          '[{"name": "100 m", "family": "sprint", "unit": "time"},
            {"name": "200 m", "family": "sprint", "unit": "time"}]'::jsonb,
  'each athlete comes with the disciplines of their start lists, the main one first');

select save_manager_lineup(pg_temp.league(), pg_temp.competition(1), jsonb_build_object(
  'starters', jsonb_build_array(
    jsonb_build_object('athlete', pg_temp.athlete(1), 'discipline', '200 m',
                       'substitute', pg_temp.athlete(2), 'threshold', 20.8),
    jsonb_build_object('athlete', pg_temp.athlete(3)),
    jsonb_build_object('athlete', pg_temp.athlete(4)),
    jsonb_build_object('athlete', pg_temp.athlete(5))),
  'bench', jsonb_build_array(jsonb_build_object('athlete', pg_temp.athlete(6)),
                             jsonb_build_object('athlete', pg_temp.athlete(2)))));

select results_eq(
  $$select athlete_id, role, slot, discipline, substitute_id, threshold
    from my_manager_sheet(pg_temp.league(), pg_temp.competition(1))
    order by role nulls last, slot$$,
  $$values (pg_temp.athlete(1), 'starter', 1, '200 m', pg_temp.athlete(2), 20.8::numeric),
           (pg_temp.athlete(3), 'starter', 2, '800 m', null::uuid, null::numeric),
           (pg_temp.athlete(4), 'starter', 3, 'Saut en longueur', null, null),
           (pg_temp.athlete(5), 'starter', 4, 'Lancer du poids', null, null),
           (pg_temp.athlete(6), 'substitute', 1, 'Lancer du disque', null, null),
           (pg_temp.athlete(2), 'substitute', 2, '100 m', null, null)$$,
  'the saved sheet reads back: starters, ordered bench, discipline, substitute and threshold');

select pg_temp.as_player(2);
select is((select count(*) from my_manager_sheet(pg_temp.league(), pg_temp.competition(1))
           where role is not null)::int, 0,
  'a participant does not read the sheet of another');
select is((select array_agg(athlete_id) from my_manager_sheet(pg_temp.league(),
                                                              pg_temp.competition(1))),
          array[pg_temp.athlete(7)], '…only their own team');
select throws_ok($$select * from my_manager_sheet(pg_temp.league(), pg_temp.competition(2))$$,
  'P0002', null, 'a competition the league does not play has no sheet');
select pg_temp.as_player(3);
select throws_ok($$select * from my_manager_sheet(pg_temp.league(), pg_temp.competition(1))$$,
  '42501', null, 'an outsider reads no sheet');

select * from finish();
rollback;
