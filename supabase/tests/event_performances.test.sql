-- pgTAP: the admin enters the performance of every athlete of an event for French Track Manager
-- (#429): place, mark, records, or DNS, DNF, DQ. Everybody reads them; only an admin writes them,
-- and reads which athletes of the start list are lined up in a Manager league.
--   One event, athletes 1 to 4 on its start list, 5 off it. Player 1 lines up 1 and 3 in a
--   Manager league; player 2 is not admin; player 3 is admin.
-- Rolled back at the end.
begin;
select plan(18);

insert into auth.users (id, email) values
  ('9e400000-0000-0000-0000-000000000001', 'one@example.test'),
  ('9e400000-0000-0000-0000-000000000002', 'two@example.test'),
  ('9e400000-0000-0000-0000-000000000003', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('9e400000-0000-0000-0000-000000000001', 'Perf Une', now()),
  ('9e400000-0000-0000-0000-000000000002', 'Perf Deux', now()),
  ('9e400000-0000-0000-0000-000000000003', 'Perf Admin', now());
update profiles set is_admin = true where id = '9e400000-0000-0000-0000-000000000003';

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('9e400000-0000-0000-0000-0000000000a' || p_n)::uuid
$$;
create function pg_temp.event() returns uuid language sql immutable as $$
  select '9e400000-0000-0000-0000-0000000000e1'::uuid
$$;
grant execute on function pg_temp.athlete(int), pg_temp.event() to authenticated, anon;

insert into athletes (id, slug, name, country_code, gender)
select pg_temp.athlete(n), 'perf-' || n, 'Perf Athlete ' || n, 'FRA', 'F'
from generate_series(1, 5) n;
insert into competitions (id, slug, name, starts_on, ends_on) values
  ('9e400000-0000-0000-0000-0000000000c1', 'perf-c1', 'Perf Meeting', current_date + 3,
   current_date + 3);
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at) values
  (pg_temp.event(), '9e400000-0000-0000-0000-0000000000c1', 'perf-e1', '100 m', 'F',
   now() + interval '2 days', now() + interval '2 days');
insert into entries (event_id, athlete_id)
select pg_temp.event(), pg_temp.athlete(n) from generate_series(1, 4) n;

insert into manager_leagues (id, name, owner_id, rules, competition_ids, mercato_opened_at,
                             mercato_closed_at)
values ('9e400000-0000-0000-0000-0000000000f1', 'Performances',
        '9e400000-0000-0000-0000-000000000001', '{"lineup": {"max": 2, "minPerFamily": {}}}',
        array['9e400000-0000-0000-0000-0000000000c1']::uuid[], now() - interval '3 days',
        now() - interval '1 day');
insert into manager_members (league_id, user_id) values
  ('9e400000-0000-0000-0000-0000000000f1', '9e400000-0000-0000-0000-000000000001');
insert into manager_lineups (league_id, competition_id, user_id, athlete_ids) values
  ('9e400000-0000-0000-0000-0000000000f1', '9e400000-0000-0000-0000-0000000000c1',
   '9e400000-0000-0000-0000-000000000001', array[pg_temp.athlete(1), pg_temp.athlete(3)]);

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    '9e400000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

-- A line for athlete n.
create function pg_temp.line(p_n int, p_status text, p_place int, p_mark text, p_records text[])
returns jsonb language sql stable as $$
  select jsonb_build_object('athlete_id', pg_temp.athlete(p_n), 'status', p_status,
    'place', p_place, 'mark', p_mark, 'records', to_jsonb(p_records))
$$;
grant execute on function pg_temp.line(int, text, int, text, text[]) to authenticated;

set local role authenticated;

-- The admin
select pg_temp.as_player(3);

select is(
  (select array_agg(a order by a) from admin_manager_lined_up(pg_temp.event()) a),
  array[pg_temp.athlete(1), pg_temp.athlete(3)],
  'an admin sees which athletes of the start list are lined up in a Manager league');

select lives_ok(
  $$select admin_set_performances(pg_temp.event(), jsonb_build_array(
      pg_temp.line(1, 'ok', 1, '10.62', array['pb', 'sb', 'nr', 'ar', 'wr']),
      pg_temp.line(2, 'ok', 2, '10.80', array[]::text[]),
      pg_temp.line(3, 'dnf', null, null, array[]::text[])))$$,
  'an admin enters places, marks, records and a DNF');

select is(
  (select array_agg(status || ':' || coalesce(place::text, '-') || ':' || coalesce(mark, '-')
                    order by athlete_id)
   from event_performances where event_id = pg_temp.event()),
  array['ok:1:10.62', 'ok:2:10.80', 'dnf:-:-'],
  'the performances are stored as entered');

select is(
  (select records from event_performances where athlete_id = pg_temp.athlete(1)),
  array['pb', 'sb', 'nr', 'ar', 'wr'],
  'the record flags are stored');

select is(
  (select count(*)::int from admin_actions
   where action = 'set_performances' and event_id = pg_temp.event()
     and admin_id = '9e400000-0000-0000-0000-000000000003'),
  1, 'the entry is logged in admin_actions');

select lives_ok(
  $$select admin_set_performances(pg_temp.event(), jsonb_build_array(
      pg_temp.line(3, 'ok', 1, '10.70', array['sb']),
      pg_temp.line(4, 'dq', null, null, array[]::text[])))$$,
  'an admin corrects the performances');

select is(
  (select array_agg(status order by athlete_id) from event_performances
   where event_id = pg_temp.event()),
  array['ok', 'dq'],
  'a correction replaces the whole previous entry');

select throws_ok(
  $$select admin_set_performances(pg_temp.event(), jsonb_build_array(
      pg_temp.line(5, 'ok', 1, '10.62', array[]::text[])))$$,
  '23503', null, 'an athlete off the start list cannot get a performance');

select throws_ok(
  $$select admin_set_performances(pg_temp.event(), jsonb_build_array(
      pg_temp.line(1, 'ok', null, null, array[]::text[])))$$,
  '23514', null, 'a finisher needs a place or a mark');

select throws_ok(
  $$select admin_set_performances(pg_temp.event(), jsonb_build_array(
      pg_temp.line(1, 'dns', 3, null, array[]::text[])))$$,
  '23514', null, 'an athlete who did not start has no place');

select throws_ok(
  $$select admin_set_performances(pg_temp.event(), jsonb_build_array(
      pg_temp.line(1, 'ok', 1, '10.62', array['olympic'])))$$,
  '23514', null, 'an unknown record flag is refused');

select throws_ok(
  $$select admin_set_performances(pg_temp.event(), jsonb_build_array(
      pg_temp.line(1, 'abandon', null, null, array[]::text[])))$$,
  '23514', null, 'an unknown status is refused');

select is(
  (select count(*)::int from admin_actions
   where action = 'set_performances' and event_id = pg_temp.event()),
  2, 'a refused entry logs nothing');

-- A player who is not admin
select pg_temp.as_player(2);

select throws_ok(
  $$select admin_set_performances(pg_temp.event(), '[]'::jsonb)$$,
  '42501', null, 'a player cannot enter or erase performances');

select throws_ok(
  $$select * from admin_manager_lined_up(pg_temp.event())$$,
  '42501', null, 'a player cannot see who is lined up');

select is(
  (select count(*)::int from event_performances where event_id = pg_temp.event()),
  2, 'everybody reads the performances, unchanged after the refused attempts');

select throws_ok(
  $$insert into event_performances (event_id, athlete_id, mark)
    values (pg_temp.event(), pg_temp.athlete(1), '9.00')$$,
  '42501', null, 'nobody writes the table directly');

-- A visitor
reset role;
set local role anon;
select is(
  (select count(*)::int from event_performances where event_id = pg_temp.event()),
  2, 'a visitor reads the performances');

select * from finish();
rollback;
