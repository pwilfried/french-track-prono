-- pgTAP: set_results replaces the official result of an event, for an admin only.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001', 'player@example.test'),
  ('dddddddd-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'Joueur', now()),
  ('dddddddd-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'dddddddd-0000-0000-0000-000000000002';

create temp table fixture as
select e.id as event_id,
       array(select athlete_id from entries where event_id = e.id order by athlete_id) as athletes
from events e where e.slug = 'f-100m';
grant select on fixture to authenticated;

-- n-th athlete of the start list as a JSON result line.
create function line(p_n int, p_rank int) returns jsonb language sql stable as $$
  select jsonb_build_object('athlete_id', athletes[p_n], 'rank', p_rank, 'mark', '') from fixture
$$;
grant execute on function line(int, int) to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$select set_results((select event_id from fixture), jsonb_build_array(line(1, 3), line(2, 2), line(3, 1)))$$,
  'an admin replaces the result of an event');

select is(
  (select array_agg(rank order by athlete_id) from results where event_id = (select event_id from fixture)),
  array[3, 2, 1], 'the new result replaces the old one entirely');

select is(
  (select count(*)::int from results where event_id = (select event_id from fixture) and mark is null), 3,
  'an empty mark is stored as none');

select is(
  (select status::text from events where id = (select event_id from fixture)), 'finished',
  'an event with an official result is finished (#488)');

select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select set_results((select event_id from fixture), jsonb_build_array(line(1, 1)))$$,
  '42501', null, 'a player cannot replace a result');

select throws_ok(
  $$select set_results((select event_id from fixture), '[]'::jsonb)$$,
  '42501', null, 'a player cannot erase a result with an empty list');

select is(
  (select count(*)::int from results where event_id = (select event_id from fixture)), 3,
  'the result is unchanged after refused attempts');

select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$select set_results((select event_id from fixture), '[]'::jsonb)$$,
  'an admin erases the result of an event');

select is(
  (select status::text from events where id = (select event_id from fixture)), 'upcoming',
  'an event whose result is erased is upcoming again');

select * from finish();
rollback;
