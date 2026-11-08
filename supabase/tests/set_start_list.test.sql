-- pgTAP: set_start_list replaces the start list of an event, for an admin only, and never removes
-- an athlete already predicted or in the result. Everything is rolled back at the end.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'player@example.test'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Joueur', now()),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'eeeeeeee-0000-0000-0000-000000000002';

-- An open event of its own with no start list, and five athletes of the seed.
create temp table fixture as
with c as (select id from competitions limit 1),
e as (
  insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
  select c.id, 'start-list-test', '100 m', 'F', now() + interval '2 days', now() + interval '1 day'
  from c returning id
)
select e.id as event_id, array(select id from athletes order by id limit 5) as athletes from e;
grant select on fixture to authenticated;

-- n-th athlete as a JSON start list line.
create function entry(p_n int, p_best text default '') returns jsonb language sql stable as $$
  select jsonb_build_object('athlete_id', athletes[p_n], 'season_best', p_best) from fixture
$$;
grant execute on function entry(int, text) to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$select set_start_list((select event_id from fixture),
    jsonb_build_array(entry(1, '10.72'), entry(2), entry(3), entry(4)))$$,
  'an admin enters the start list of an event');

select is(
  (select count(*)::int from entries where event_id = (select event_id from fixture)), 4,
  'the four athletes are on the start list');

select lives_ok(
  $$select set_start_list((select event_id from fixture),
    jsonb_build_array(entry(1, '10.70'), entry(2), entry(3), entry(5)))$$,
  'an admin replaces an athlete and changes a season best');

select is(
  (select array_agg(season_best order by athlete_id) filter (where season_best is not null)
     from entries where event_id = (select event_id from fixture)),
  array['10.70'], 'the season best is updated, an empty one stays unknown');

-- The player predicts athletes 1, 2, 3; the admin enters athlete 5 as the winner.
reset role;
insert into predictions (user_id, event_id, p1, p2, p3)
select 'eeeeeeee-0000-0000-0000-000000000001', event_id, athletes[1], athletes[2], athletes[3]
from fixture;
insert into results (event_id, athlete_id, rank) select event_id, athletes[5], 1 from fixture;
set local role authenticated;

select throws_ok(
  $$select set_start_list((select event_id from fixture),
    jsonb_build_array(entry(2), entry(3), entry(5)))$$,
  '23503', null, 'an athlete already predicted cannot be removed');

select throws_ok(
  $$select set_start_list((select event_id from fixture),
    jsonb_build_array(entry(1), entry(2), entry(3)))$$,
  '23503', null, 'an athlete of the result cannot be removed');

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select set_start_list((select event_id from fixture), jsonb_build_array(entry(1)))$$,
  '42501', null, 'a player cannot change a start list');

select is(
  (select count(*)::int from entries where event_id = (select event_id from fixture)), 4,
  'the start list is unchanged after refused attempts');

select * from finish();
rollback;
