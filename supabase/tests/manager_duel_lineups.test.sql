-- pgTAP: the lineups of a head-to-head (#605). A lineup stays secret until the lock of its
-- competition; from then on every participant of the league reads every lineup of it.
--   c1 open (locks in 2 days), c2 locked (an hour ago), c3 not a competition of the league.
--   Players 1 and 2 in the league, both lined up in c1 and c2. Player 3: not in the league.
-- Rolled back at the end.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('d0e10000-0000-0000-0000-000000000001', 'one@example.test'),
  ('d0e10000-0000-0000-0000-000000000002', 'two@example.test'),
  ('d0e10000-0000-0000-0000-000000000003', 'three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('d0e10000-0000-0000-0000-000000000001', 'Duel Une', now()),
  ('d0e10000-0000-0000-0000-000000000002', 'Duel Deux', now()),
  ('d0e10000-0000-0000-0000-000000000003', 'Duel Trois', now());

create function pg_temp.competition(p_n int) returns uuid language sql immutable as $$
  select ('d0e10000-0000-0000-0000-0000000000c' || p_n)::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select 'd0e10000-0000-0000-0000-0000000000f1'::uuid
$$;
create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('d0e10000-0000-0000-0000-0000000000a' || p_n)::uuid
$$;
grant execute on function pg_temp.competition(int), pg_temp.league(), pg_temp.athlete(int)
  to authenticated, anon;

insert into competitions (id, slug, name, starts_on, ends_on)
select pg_temp.competition(n), 'duel-c' || n, 'Duel Meeting ' || n, current_date + days,
       current_date + days
from (values (1, 3), (2, 0), (3, 3)) as t(n, days);
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select pg_temp.competition(n), 'duel-e' || n, '100 m', 'F', lock_at, lock_at
from (values (1, now() + interval '2 days'), (2, now() - interval '1 hour'),
             (3, now() + interval '2 days')) as t(n, lock_at);

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at)
values (pg_temp.league(), 'Confrontation', 'd0e10000-0000-0000-0000-000000000001', '{}',
        array[pg_temp.competition(1), pg_temp.competition(2)],
        now() - interval '3 days', now() - interval '1 day');
insert into manager_members (league_id, user_id) values
  (pg_temp.league(), 'd0e10000-0000-0000-0000-000000000001'),
  (pg_temp.league(), 'd0e10000-0000-0000-0000-000000000002');

-- The lineups were validated before the lock: the lock trigger is set aside to write them here.
alter table manager_lineups disable trigger trg_manager_lineup_lock;
insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
select pg_temp.league(), pg_temp.competition(c), ('d0e10000-0000-0000-0000-00000000000' || p)::uuid,
       array[pg_temp.athlete(p * 2), pg_temp.athlete(p * 2 - 1)]
from (values (1), (2)) as cs(c), (values (1), (2)) as ps(p);
alter table manager_lineups enable trigger trg_manager_lineup_lock;

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'd0e10000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

set local role authenticated;
select pg_temp.as_player(2);

select is(manager_duel_lineups(pg_temp.league(), pg_temp.competition(1)),
  '{"locked": false, "lineups": []}'::jsonb,
  'before the lock, no lineup of the competition is shown, not even the opponent''s');
select is((manager_duel_lineups(pg_temp.league(), pg_temp.competition(2)) ->> 'locked')::boolean,
  true, 'from the lock on, the competition says it is locked');
select is(manager_duel_lineups(pg_temp.league(), pg_temp.competition(2)) -> 'lineups',
  jsonb_build_array(
    jsonb_build_object('user_id', 'd0e10000-0000-0000-0000-000000000001',
                       'athlete_ids', jsonb_build_array(pg_temp.athlete(2), pg_temp.athlete(1))),
    jsonb_build_object('user_id', 'd0e10000-0000-0000-0000-000000000002',
                       'athlete_ids', jsonb_build_array(pg_temp.athlete(4), pg_temp.athlete(3)))),
  '…and a participant reads both lineups, in the order they were validated');
select is((select count(*)::int from manager_lineups), 2,
  'the table still shows a player their own lineups only');

select pg_temp.as_player(1);
select is(jsonb_array_length(manager_duel_lineups(pg_temp.league(), pg_temp.competition(2))
                             -> 'lineups'), 2,
  'the other player of the head-to-head reads them too');
select throws_ok(
  format('select manager_duel_lineups(%L, %L)', pg_temp.league(), pg_temp.competition(3)),
  'P0002', null, 'a competition that is not one of the league is refused');

select pg_temp.as_player(3);
select throws_ok(
  format('select manager_duel_lineups(%L, %L)', pg_temp.league(), pg_temp.competition(2)),
  '42501', null, 'a player outside the league reads no lineup, even after the lock');

reset role;
set local role anon;
select throws_ok(
  format('select manager_duel_lineups(%L, %L)', pg_temp.league(), pg_temp.competition(2)),
  '42501', null, 'a visitor cannot call it');
reset role;

select ok(not has_function_privilege('anon', 'manager_duel_lineups(uuid,uuid)', 'execute'),
  'anon has no right on the function');

select * from finish();
rollback;
