-- pgTAP: every back-office RPC leaves one line in admin_actions, readable by admins only and
-- written by nobody else. Everything is rolled back at the end.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('ffffffff-0000-0000-0000-000000000001', 'player@example.test'),
  ('ffffffff-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('ffffffff-0000-0000-0000-000000000001', 'Joueur', now()),
  ('ffffffff-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'ffffffff-0000-0000-0000-000000000002';

create temp table fixture as
select e.id as event_id,
       array(select athlete_id from entries where event_id = e.id order by athlete_id) as athletes
from events e where e.slug = 'f-100m';
grant select on fixture to authenticated;

create function podium() returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_object('athlete_id', athletes[1], 'rank', 1, 'mark', '10.80'),
    jsonb_build_object('athlete_id', athletes[2], 'rank', 2, 'mark', ''),
    jsonb_build_object('athlete_id', athletes[3], 'rank', 3, 'mark', ''))
  from fixture
$$;
grant execute on function podium() to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-0000-0000-000000000002","role":"authenticated"}', true);

select set_results((select event_id from fixture), podium());

select is(
  (select payload from admin_actions
    where action = 'set_results' and event_id = (select event_id from fixture)
      and admin_id = 'ffffffff-0000-0000-0000-000000000002'),
  podium(), 'entering a podium logs set_results with the whole podium');

select set_event_scores((select event_id from fixture), '[]'::jsonb);
select set_event_scores((select event_id from fixture), '[]'::jsonb);

select is(
  (select count(*)::int from admin_actions
    where action = 'run_scoring' and event_id = (select event_id from fixture)),
  2, 'computing twice leaves two run_scoring lines');

select set_start_list((select event_id from fixture),
  (select jsonb_agg(jsonb_build_object('athlete_id', a, 'season_best', '')) from fixture, unnest(athletes) a));

select is(
  (select count(*)::int from admin_actions
    where action = 'set_start_list' and event_id = (select event_id from fixture)),
  1, 'entering a start list logs set_start_list');

select throws_ok(
  $$insert into admin_actions (action, payload) values ('set_results', '{}')$$,
  '42501', null, 'an admin cannot write the log directly');

select throws_ok(
  $$delete from admin_actions$$ , '42501', null, 'an admin cannot erase the log');

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from admin_actions), 0, 'a player reads no line of the log');

select throws_ok(
  $$select set_results((select event_id from fixture), podium())$$,
  '42501', null, 'a refused call logs nothing');

reset role;
select is(
  (select count(*)::int from admin_actions where event_id = (select event_id from fixture)),
  4, 'only the four successful calls are logged');

select * from finish();
rollback;
