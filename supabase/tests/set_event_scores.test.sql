-- pgTAP: set_event_scores replaces the prediction points of an event, for an admin only (S12).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(5);

insert into auth.users (id, email) values
  ('eeeeeeee-1111-0000-0000-000000000001', 'player@example.test'),
  ('eeeeeeee-1111-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('eeeeeeee-1111-0000-0000-000000000001', 'Joueur', now()),
  ('eeeeeeee-1111-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'eeeeeeee-1111-0000-0000-000000000002';

create temp table fixture as select id as event_id from events where slug = 'f-100m';
grant select on fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-1111-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$select set_event_scores((select event_id from fixture), jsonb_build_array(
      jsonb_build_object('user_id', 'eeeeeeee-1111-0000-0000-000000000001', 'points', 12,
                         'detail', jsonb_build_object('reasons', jsonb_build_array('perfect_podium')))))$$,
  'an admin stores the points of an event');

select lives_ok(
  $$select set_event_scores((select event_id from fixture), jsonb_build_array(
      jsonb_build_object('user_id', 'eeeeeeee-1111-0000-0000-000000000001', 'points', 12)))$$,
  'an admin computes the same event again');

select is(
  (select count(*)::int from score_events where event_id = (select event_id from fixture) and source = 'prediction'),
  1, 'computing twice leaves one line per player (S12)');

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-1111-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select set_event_scores((select event_id from fixture), '[]'::jsonb)$$,
  '42501', null, 'a player cannot change the points');

select is(
  (select points from score_events where event_id = (select event_id from fixture) and source = 'prediction'),
  12, 'the points are unchanged after a refused attempt');

select * from finish();
rollback;
