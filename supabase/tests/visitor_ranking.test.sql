-- pgTAP: a visitor reads the general ranking (#573), and nothing more.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(10);

-- Two players with points on a seed event (fictional addresses); the second one is blocked.
insert into auth.users (id, email) values
  ('c0c00000-0000-0000-0000-000000000001', 'visible@example.test'),
  ('c0c00000-0000-0000-0000-000000000002', 'blocked@example.test');
insert into profiles (id, pseudo, age_confirmed_at, blocked_at, bib_number, bib_color) values
  ('c0c00000-0000-0000-0000-000000000001', 'Visible', now(), null, 42, 'red'),
  ('c0c00000-0000-0000-0000-000000000002', 'Bloqué', now(), now(), 7, 'blue');
insert into score_events (user_id, competition_id, event_id, source, points, reason)
select u.id, e.competition_id, e.id, 'prediction', 12, 'prediction'
from (values ('c0c00000-0000-0000-0000-000000000001'::uuid),
             ('c0c00000-0000-0000-0000-000000000002'::uuid)) as u(id),
     (select id, competition_id from events order by starts_at limit 1) as e;

-- A visitor: no identity ----------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*) from score_events where user_id = 'c0c00000-0000-0000-0000-000000000001'),
  1::bigint, 'a visitor reads the score lines of a player');
select is(
  (select count(*) from score_events where user_id = 'c0c00000-0000-0000-0000-000000000002'),
  0::bigint, 'a visitor does not read the score lines of a blocked player');
select is(
  (select pseudo || ' ' || bib_number || ' ' || bib_color from profiles
   where id = 'c0c00000-0000-0000-0000-000000000001'),
  'Visible 42 red',
  'a visitor reads the pseudo and the bib of a player');
select is(
  (select count(*) from profiles where id = 'c0c00000-0000-0000-0000-000000000002'),
  0::bigint, 'a visitor does not read the profile of a blocked player');
select throws_ok($$select is_admin from profiles$$, '42501', null,
  'a visitor does not read who is an admin');
select throws_ok($$select age_confirmed_at, blocked_at from profiles$$, '42501', null,
  'a visitor does not read the private columns of a profile');
select throws_ok(
  $$insert into score_events (user_id, competition_id, event_id, source, points, reason)
    select 'c0c00000-0000-0000-0000-000000000001', competition_id, id, 'prediction', 28, 'prediction'
    from events limit 1$$,
  '42501', null, 'a visitor cannot write a score line');
select lives_ok($$update profiles set pseudo = 'Pirate'$$,
  'a visitor may send a change of profile, which touches no row');
select is(
  (select count(*) from player_details), 0::bigint,
  'a visitor reads no private detail of a player');

-- Back to the database owner to look at what the visitor changed.
reset role;
select is(
  (select pseudo from profiles where id = 'c0c00000-0000-0000-0000-000000000001'),
  'Visible', 'a visitor cannot change a profile');

select * from finish();
rollback;
