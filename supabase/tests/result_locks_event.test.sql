-- pgTAP: R10, a result entered before the lock locks the event at once (#1063), through either
-- writer of the official podium (set_results, admin_set_performances). Run with
-- `supabase test db`. Everything is rolled back at the end.
begin;
select plan(14);

insert into auth.users (id, email) values
  ('abababab-0000-0000-0000-000000000001', 'anna@example.test'),
  ('abababab-0000-0000-0000-000000000002', 'bob@example.test'),
  ('abababab-0000-0000-0000-000000000003', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('abababab-0000-0000-0000-000000000001', 'Anna', now()),
  ('abababab-0000-0000-0000-000000000002', 'Bob', now()),
  ('abababab-0000-0000-0000-000000000003', 'Admin', now());
update profiles set is_admin = true where id = 'abababab-0000-0000-0000-000000000003';

-- Three open events (a: set_results, b: the results sheet, c: an erased result) and one already
-- locked (d), with the same start list.
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select v.id::uuid, c.id, v.slug, '100 m', 'F', now() + v.lock + interval '5 minutes', now() + v.lock
from competitions c,
     (values ('eeeeeeee-0000-0000-0000-0000000000a1', 'lock-a', interval '1 day'),
             ('eeeeeeee-0000-0000-0000-0000000000b1', 'lock-b', interval '1 day'),
             ('eeeeeeee-0000-0000-0000-0000000000c1', 'lock-c', interval '1 day'),
             ('eeeeeeee-0000-0000-0000-0000000000d1', 'lock-d', interval '-1 hour'))
       as v(id, slug, lock)
where c.slug = 'ultimate-championship-2026';
insert into entries (event_id, athlete_id)
select e.id, s.athlete_id
from events e,
     (select athlete_id from entries
      where event_id = (select id from events where slug = 'f-100m')
      order by athlete_id limit 4) s
where e.slug like 'lock-_';

-- n-th athlete of a test event, in a stable order.
create function test_athlete(p_event uuid, p_n int) returns uuid
language sql stable as $$
  select athlete_id from entries where event_id = p_event order by athlete_id offset p_n - 1 limit 1
$$;
grant execute on function test_athlete(uuid, int) to authenticated;

-- A podium of a test event as result lines.
create function test_podium(p_event uuid) returns jsonb
language sql stable as $$
  select jsonb_build_array(
    jsonb_build_object('athlete_id', test_athlete(p_event, 1), 'rank', 1, 'mark', ''),
    jsonb_build_object('athlete_id', test_athlete(p_event, 2), 'rank', 2, 'mark', ''),
    jsonb_build_object('athlete_id', test_athlete(p_event, 3), 'rank', 3, 'mark', ''))
$$;
grant execute on function test_podium(uuid) to authenticated;

-- Each test player predicts from a league of the competition (#311).
insert into leagues (name, owner_id) select 'Test ' || pseudo, id from profiles where created_at = now();
insert into league_members (league_id, user_id, role)
select l.id, l.owner_id, 'owner' from leagues l join profiles p on p.id = l.owner_id where p.created_at = now();
insert into league_competitions (league_id, competition_id)
select l.id, c.id from leagues l join profiles p on p.id = l.owner_id, competitions c where p.created_at = now();

set local role authenticated;

-- Bob predicts the open events.
select set_config('request.jwt.claims',
  '{"sub":"abababab-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into predictions (user_id, event_id, p1, p2, p3)
select 'abababab-0000-0000-0000-000000000002', e.id,
       test_athlete(e.id, 1), test_athlete(e.id, 2), test_athlete(e.id, 3)
from events e where e.slug in ('lock-a', 'lock-b');

-- Anna cannot see it yet (R3).
select set_config('request.jwt.claims',
  '{"sub":"abababab-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from predictions where user_id = 'abababab-0000-0000-0000-000000000002'), 0,
  'before the result, the predictions of others are hidden');

-- The admin enters the result of event a before its lock.
select set_config('request.jwt.claims',
  '{"sub":"abababab-0000-0000-0000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$select set_results('eeeeeeee-0000-0000-0000-0000000000a1', test_podium('eeeeeeee-0000-0000-0000-0000000000a1'))$$,
  'an admin enters a result before the lock');
select is((select lock_at from events where slug = 'lock-a'), now(),
  'R10: entering a result before the lock locks the event now');
select is(
  (select count(*)::int from admin_actions
   where action = 'lock_event' and event_id = 'eeeeeeee-0000-0000-0000-0000000000a1'
     and admin_id = 'abababab-0000-0000-0000-000000000003'),
  1, 'the lock is written in the admin log');
select ok(
  (select (payload ->> 'lock_at')::timestamptz > now() from admin_actions
   where action = 'lock_event' and event_id = 'eeeeeeee-0000-0000-0000-0000000000a1'),
  'the log keeps the lock time the event had');

-- The results sheet locks too.
select lives_ok(
  $$select admin_set_performances('eeeeeeee-0000-0000-0000-0000000000b1', jsonb_build_array(
      jsonb_build_object('athlete_id', test_athlete('eeeeeeee-0000-0000-0000-0000000000b1', 1), 'place', 1),
      jsonb_build_object('athlete_id', test_athlete('eeeeeeee-0000-0000-0000-0000000000b1', 2), 'place', 2),
      jsonb_build_object('athlete_id', test_athlete('eeeeeeee-0000-0000-0000-0000000000b1', 3), 'place', 3)))$$,
  'an admin saves a results sheet before the lock');
select is((select lock_at from events where slug = 'lock-b'), now(),
  'R10: saving a results sheet before the lock locks the event now');

-- An erased result does not lock; an event already locked keeps its lock time, with no log line.
select lives_ok(
  $$select set_results('eeeeeeee-0000-0000-0000-0000000000c1', '[]'::jsonb)$$,
  'an admin erases the result of an open event');
select ok((select lock_at > now() from events where slug = 'lock-c'),
  'erasing a result does not lock the event');
select lives_ok(
  $$select set_results('eeeeeeee-0000-0000-0000-0000000000d1', test_podium('eeeeeeee-0000-0000-0000-0000000000d1'))$$,
  'an admin enters the result of a locked event');
select is((select lock_at from events where slug = 'lock-d'), now() - interval '1 hour',
  'an event already locked keeps its lock time');
select is(
  (select count(*)::int from admin_actions
   where action = 'lock_event' and event_id = 'eeeeeeee-0000-0000-0000-0000000000d1'),
  0, 'no lock line for an event already locked');

-- Anna: no prediction any more, and Bob's is revealed (R2, R4).
select set_config('request.jwt.claims',
  '{"sub":"abababab-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    select 'abababab-0000-0000-0000-000000000001', e, test_athlete(e, 1), test_athlete(e, 2), test_athlete(e, 3)
    from (select 'eeeeeeee-0000-0000-0000-0000000000a1'::uuid as e) x$$,
  'P0001', null, 'R10: no prediction is accepted once the result locked the event');
select is((select count(*)::int from predictions where user_id = 'abababab-0000-0000-0000-000000000002'), 2,
  'once the result locked the event, the predictions of others are revealed');

select * from finish();
rollback;
