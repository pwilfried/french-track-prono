-- pgTAP: prediction rules R1 to R7 (lock, visibility, entries, duplicates, joker).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(16);

-- Test players and three open events with the same start list ----------------------------
insert into auth.users (id, email) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'anna@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Anna', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Bob', now());

insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select v.id::uuid, c.id, v.slug, '100 m', 'F', now() + interval '1 day', now() + interval '1 day' - interval '5 minutes'
from competitions c,
     (values ('eeeeeeee-0000-0000-0000-00000000000a', 'test-a'),
             ('eeeeeeee-0000-0000-0000-00000000000b', 'test-b'),
             ('eeeeeeee-0000-0000-0000-00000000000c', 'test-c')) as v(id, slug)
where c.slug = 'ultimate-championship-2026';

insert into entries (event_id, athlete_id)
select e.id, s.athlete_id
from events e,
     (select athlete_id from entries
      where event_id = (select id from events where slug = 'f-100m')
      order by athlete_id limit 4) s
where e.slug in ('test-a', 'test-b', 'test-c');

-- n-th athlete of a test event, in a stable order.
create function test_athlete(p_event uuid, p_n int) returns uuid
language sql stable as $$
  select athlete_id from entries where event_id = p_event order by athlete_id offset p_n - 1 limit 1
$$;

-- Signed in as Anna -------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- R1: write before the lock
select lives_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3, use_joker)
    select 'bbbbbbbb-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000a',
           test_athlete(e, 1), test_athlete(e, 2), test_athlete(e, 3), true
    from (select 'eeeeeeee-0000-0000-0000-00000000000a'::uuid as e) x$$,
  'R1: a prediction can be created before the lock');

select lives_ok(
  $$update predictions set p1 = test_athlete(event_id, 2), p2 = test_athlete(event_id, 1)
    where event_id = 'eeeeeeee-0000-0000-0000-00000000000a'$$,
  'R1: a prediction can be changed before the lock');

-- R2: no new prediction on an event that has already started
select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    select 'bbbbbbbb-0000-0000-0000-000000000001', e.id,
           test_athlete(e.id, 1), test_athlete(e.id, 2), test_athlete(e.id, 3)
    from events e where e.slug = 'f-100m'$$,
  'P0001', null,
  'R2: a prediction cannot be created after the lock');

-- Nobody can write for another player
select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    select 'bbbbbbbb-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-00000000000b',
           test_athlete(e, 1), test_athlete(e, 2), test_athlete(e, 3)
    from (select 'eeeeeeee-0000-0000-0000-00000000000b'::uuid as e) x$$,
  '42501', null,
  'a player cannot write a prediction for someone else');

-- R5: only athletes on the start list
select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    select 'bbbbbbbb-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000b',
           (select id from athletes
            where id not in (select athlete_id from entries where event_id = 'eeeeeeee-0000-0000-0000-00000000000b')
            limit 1),
           test_athlete(e, 2), test_athlete(e, 3)
    from (select 'eeeeeeee-0000-0000-0000-00000000000b'::uuid as e) x$$,
  '23503', null,
  'R5: an athlete who is not on the start list is refused');

-- R6: the same athlete cannot be on two steps
select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    select 'bbbbbbbb-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000b',
           test_athlete(e, 1), test_athlete(e, 1), test_athlete(e, 3)
    from (select 'eeeeeeee-0000-0000-0000-00000000000b'::uuid as e) x$$,
  '23514', null,
  'R6: the same athlete on two steps is refused');

-- R7: one joker per competition (Anna already uses hers on event A)
select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3, use_joker)
    select 'bbbbbbbb-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000b',
           test_athlete(e, 1), test_athlete(e, 2), test_athlete(e, 3), true
    from (select 'eeeeeeee-0000-0000-0000-00000000000b'::uuid as e) x$$,
  '23505', null,
  'R7: a second joker in the same competition is refused');

-- Delete before the lock works
select lives_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    select 'bbbbbbbb-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000b',
           test_athlete(e, 1), test_athlete(e, 2), test_athlete(e, 3)
    from (select 'eeeeeeee-0000-0000-0000-00000000000b'::uuid as e) x$$,
  'a prediction without joker can be created on event B');
delete from predictions where event_id = 'eeeeeeee-0000-0000-0000-00000000000b';
select is(
  (select count(*) from predictions where event_id = 'eeeeeeee-0000-0000-0000-00000000000b'), 0::bigint,
  'a prediction can be deleted before the lock');

-- Prediction on event C, to be locked later
select lives_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    select 'bbbbbbbb-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000c',
           test_athlete(e, 1), test_athlete(e, 2), test_athlete(e, 3)
    from (select 'eeeeeeee-0000-0000-0000-00000000000c'::uuid as e) x$$,
  'a prediction can be created on event C');

-- R3: Bob cannot read Anna's predictions before the lock ------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
  (select count(*) from predictions where event_id in
     ('eeeeeeee-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-00000000000c')),
  0::bigint,
  'R3: another player''s prediction is invisible before the lock');

-- Event C starts: lock it -------------------------------------------------------------------
reset role;
update events set starts_at = now() - interval '1 minute', lock_at = now() - interval '1 minute'
where id = 'eeeeeeee-0000-0000-0000-00000000000c';
set local role authenticated;

-- R4: Bob can read it now
select is(
  (select count(*) from predictions where event_id = 'eeeeeeee-0000-0000-0000-00000000000c'), 1::bigint,
  'R4: another player''s prediction is visible after the lock');

-- Back to Anna: change and delete are refused after the lock ----------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$update predictions set p1 = test_athlete(event_id, 2), p2 = test_athlete(event_id, 1)
    where event_id = 'eeeeeeee-0000-0000-0000-00000000000c'$$,
  'P0001', null,
  'R2: a prediction cannot be changed after the lock');

delete from predictions where event_id = 'eeeeeeee-0000-0000-0000-00000000000c';
select is(
  (select count(*) from predictions where event_id = 'eeeeeeee-0000-0000-0000-00000000000c'), 1::bigint,
  'a prediction cannot be deleted after the lock');

-- Deleting the event still removes its predictions (foreign keys are not blocked) -----------------
reset role;
select lives_ok(
  $$delete from events where id = 'eeeeeeee-0000-0000-0000-00000000000c'$$,
  'an event can still be deleted with its predictions');
select is(
  (select count(*) from predictions where event_id = 'eeeeeeee-0000-0000-0000-00000000000c'), 0::bigint,
  'the predictions of a deleted event are gone');

select * from finish();
rollback;
