-- pgTAP: a player writes only the podium and the marks of his predictions (#911).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(13);

insert into auth.users (id, email) values ('cccccccc-0911-0000-0000-000000000001', 'anna@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cccccccc-0911-0000-0000-000000000001', 'Anna911', now());

-- Two open events and one locked event, with the same start list.
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select v.id::uuid, c.id, v.slug, '100 m', 'F', now() + v.shift, now() + v.shift - interval '5 minutes'
from competitions c,
     (values ('eeeeeeee-0911-0000-0000-00000000000a', 'test-911-a', interval '1 day'),
             ('eeeeeeee-0911-0000-0000-00000000000b', 'test-911-b', interval '1 day'),
             ('eeeeeeee-0911-0000-0000-00000000000c', 'test-911-c', interval '-1 hour')) as v(id, slug, shift)
where c.slug = 'ultimate-championship-2026';
insert into entries (event_id, athlete_id)
select e.id, s.athlete_id
from events e,
     (select athlete_id from entries
      where event_id = (select id from events where slug = 'f-100m')
      order by athlete_id limit 4) s
where e.slug in ('test-911-a', 'test-911-b', 'test-911-c');

create function test_athlete(p_event uuid, p_n int) returns uuid
language sql stable as $$
  select athlete_id from entries where event_id = p_event order by athlete_id offset p_n - 1 limit 1
$$;

insert into leagues (name, owner_id) values ('Test 911', 'cccccccc-0911-0000-0000-000000000001');
insert into league_members (league_id, user_id, role)
select id, owner_id, 'owner' from leagues where name = 'Test 911';
insert into league_competitions (league_id, competition_id)
select l.id, c.id from leagues l, competitions c
where l.name = 'Test 911' and c.slug = 'ultimate-championship-2026';

-- Signed in as Anna, with a prediction on event A --------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0911-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3, m1)
    select 'cccccccc-0911-0000-0000-000000000001', e, test_athlete(e, 1), test_athlete(e, 2),
           test_athlete(e, 3), 11.10
    from (select 'eeeeeeee-0911-0000-0000-00000000000a'::uuid as e) x$$,
  'a player creates a prediction with his podium and marks');

select lives_ok(
  $$update predictions set p1 = test_athlete(event_id, 2), p2 = test_athlete(event_id, 1),
           m1 = null, m2 = 11.20, m3 = 11.30
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  'a player changes his podium and marks');

select throws_ok(
  $$update predictions set event_id = 'eeeeeeee-0911-0000-0000-00000000000b'
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  '42501', null,
  'a player cannot move his prediction to another event');

select throws_ok(
  $$update predictions set points_awarded = 28
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  '42501', null,
  'a player cannot set the points of his prediction');

select throws_ok(
  $$update predictions set created_at = now() - interval '1 year'
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  '42501', null,
  'a player cannot change the creation date of his prediction');

select throws_ok(
  $$update predictions set updated_at = now() - interval '1 year'
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  '42501', null,
  'a player cannot change the update date of his prediction');

select throws_ok(
  $$update predictions set competition_id = gen_random_uuid()
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  '42501', null,
  'a player cannot change the competition of his prediction');

select throws_ok(
  $$update predictions set user_id = 'cccccccc-0911-0000-0000-000000000001'
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  '42501', null,
  'a player cannot change the owner of his prediction');

select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3, points_awarded)
    select 'cccccccc-0911-0000-0000-000000000001', e, test_athlete(e, 1), test_athlete(e, 2),
           test_athlete(e, 3), 28
    from (select 'eeeeeeee-0911-0000-0000-00000000000b'::uuid as e) x$$,
  '42501', null,
  'a player cannot create a prediction with points');

select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3, created_at)
    select 'cccccccc-0911-0000-0000-000000000001', e, test_athlete(e, 1), test_athlete(e, 2),
           test_athlete(e, 3), now() - interval '1 year'
    from (select 'eeeeeeee-0911-0000-0000-00000000000b'::uuid as e) x$$,
  '42501', null,
  'a player cannot create a prediction with a date of his own');

select is(
  (select points_awarded is null and updated_at >= created_at from predictions
   where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'),
  true,
  'the points and the dates of the prediction are untouched');

-- The server moves a prediction: the lock of the new event applies ----------------------------
reset role;

select throws_ok(
  $$update predictions set event_id = 'eeeeeeee-0911-0000-0000-00000000000c'
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  'P0001', null,
  'a prediction cannot be moved to a locked event');

select lives_ok(
  $$update predictions set event_id = 'eeeeeeee-0911-0000-0000-00000000000b'
    where event_id = 'eeeeeeee-0911-0000-0000-00000000000a'$$,
  'a prediction can be moved by the server to another open event');

select * from finish();
rollback;
