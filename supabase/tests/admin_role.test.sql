-- pgTAP: admin role. Only an admin writes results and points; nobody becomes admin from the API.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'player@example.test'),
  ('cccccccc-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cccccccc-0000-0000-0000-000000000001', 'Joueur', now()),
  ('cccccccc-0000-0000-0000-000000000002', 'Admin', now());
-- Designating the admin from SQL works (this is how it is done, see docs/SETUP.md).
update profiles set is_admin = true where id = 'cccccccc-0000-0000-0000-000000000002';

-- An event with a start list and no result.
create temp table fixture as
select e.id as event_id, e.competition_id,
       (select athlete_id from entries where event_id = e.id order by athlete_id limit 1) as athlete_id
from events e where e.slug = 'f-100m';
grant select on fixture to authenticated;
delete from results where event_id = (select event_id from fixture);

select is((select is_admin from profiles where id = 'cccccccc-0000-0000-0000-000000000001'), false,
  'a new profile is not admin');

-- Signed in as a player ------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(is_admin(), false, 'is_admin() is false for a player');

select throws_ok(
  $$insert into results (event_id, athlete_id, rank) select event_id, athlete_id, 1 from fixture$$,
  '42501', null, 'a player cannot write a result');

select throws_ok(
  $$insert into score_events (user_id, competition_id, event_id, source, points, reason)
    select 'cccccccc-0000-0000-0000-000000000001', competition_id, event_id, 'prediction', 28, 'test'
    from fixture$$,
  '42501', null, 'a player cannot give himself points');

select throws_ok(
  $$update profiles set is_admin = true where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  '42501', null, 'a player cannot make himself admin');

select lives_ok(
  $$update profiles set pseudo = 'Joueur2' where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  'a player can still update his own profile');

-- Signed in as the admin -----------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(is_admin(), true, 'is_admin() is true for an admin');

select lives_ok(
  $$insert into results (event_id, athlete_id, rank, mark) select event_id, athlete_id, 1, '10.80' from fixture$$,
  'an admin can write a result');

select lives_ok(
  $$insert into score_events (user_id, competition_id, event_id, source, points, reason)
    select 'cccccccc-0000-0000-0000-000000000001', competition_id, event_id, 'prediction', 3, 'test'
    from fixture$$,
  'an admin can write points');

select throws_ok(
  $$update profiles set is_admin = false where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  '42501', null, 'the admin flag cannot be changed from the API, even by an admin');

-- Back to a player: results and points are still readable.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from results where event_id = (select event_id from fixture)), 1,
  'a player reads the results written by the admin');

select * from finish();
rollback;
