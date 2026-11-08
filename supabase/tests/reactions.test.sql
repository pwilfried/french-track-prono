-- pgTAP: reactions. After the lock only, never on one's own prediction, fixed emoji list.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('ffff0000-0000-0000-0000-000000000001', 'anna@example.test'),
  ('ffff0000-0000-0000-0000-000000000002', 'bob@example.test'),
  ('ffff0000-0000-0000-0000-000000000003', 'cleo@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('ffff0000-0000-0000-0000-000000000001', 'Anna', now()),
  ('ffff0000-0000-0000-0000-000000000002', 'Bob', now()),
  ('ffff0000-0000-0000-0000-000000000003', 'Cleo', now());

-- An open event with three athletes, and Anna's prediction on it.
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select 'ffff0000-0000-0000-0000-0000000000e1', c.id, 'test-reactions', '100 m', 'F',
       now() + interval '1 day', now() + interval '1 hour'
from competitions c where c.slug = 'ultimate-championship-2026';
insert into entries (event_id, athlete_id)
select 'ffff0000-0000-0000-0000-0000000000e1', athlete_id from entries
where event_id = (select id from events where slug = 'f-100m');
insert into predictions (id, user_id, event_id, p1, p2, p3)
select 'ffff0000-0000-0000-0000-0000000000a1', 'ffff0000-0000-0000-0000-000000000001',
       'ffff0000-0000-0000-0000-0000000000e1', a[1], a[2], a[3]
from (select array_agg(athlete_id order by athlete_id) a from entries
      where event_id = 'ffff0000-0000-0000-0000-0000000000e1') x;

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;
select act_as('ffff0000-0000-0000-0000-000000000002');

select throws_ok(
  $$insert into reactions (prediction_id, user_id, emoji)
    values ('ffff0000-0000-0000-0000-0000000000a1', 'ffff0000-0000-0000-0000-000000000002', '🔥')$$,
  '42501', null, 'no reaction before the lock');

-- The event locks.
reset role;
update events set lock_at = now() - interval '1 minute' where id = 'ffff0000-0000-0000-0000-0000000000e1';
set local role authenticated;
select act_as('ffff0000-0000-0000-0000-000000000002');

select lives_ok(
  $$insert into reactions (prediction_id, user_id, emoji)
    values ('ffff0000-0000-0000-0000-0000000000a1', 'ffff0000-0000-0000-0000-000000000002', '🔥')$$,
  'a player reacts to someone else''s prediction after the lock');

select throws_ok(
  $$insert into reactions (prediction_id, user_id, emoji)
    values ('ffff0000-0000-0000-0000-0000000000a1', 'ffff0000-0000-0000-0000-000000000002', '😂')$$,
  '23505', null, 'one reaction per player and prediction');

select lives_ok(
  $$update reactions set emoji = '😂'
    where prediction_id = 'ffff0000-0000-0000-0000-0000000000a1' and user_id = 'ffff0000-0000-0000-0000-000000000002'$$,
  'a player changes his reaction');

select act_as('ffff0000-0000-0000-0000-000000000003');
select throws_ok(
  $$insert into reactions (prediction_id, user_id, emoji)
    values ('ffff0000-0000-0000-0000-0000000000a1', 'ffff0000-0000-0000-0000-000000000003', '💩')$$,
  '23514', null, 'an emoji outside the list is refused');
select act_as('ffff0000-0000-0000-0000-000000000002');

select throws_ok(
  $$insert into reactions (prediction_id, user_id, emoji)
    values ('ffff0000-0000-0000-0000-0000000000a1', 'ffff0000-0000-0000-0000-000000000003', '🔥')$$,
  '42501', null, 'nobody reacts in someone else''s name');

select act_as('ffff0000-0000-0000-0000-000000000001');
select throws_ok(
  $$insert into reactions (prediction_id, user_id, emoji)
    values ('ffff0000-0000-0000-0000-0000000000a1', 'ffff0000-0000-0000-0000-000000000001', '🎯')$$,
  '42501', null, 'no reaction to one''s own prediction');

select is((select emoji from reactions where prediction_id = 'ffff0000-0000-0000-0000-0000000000a1'), '😂',
  'everybody reads the reactions');

delete from reactions where prediction_id = 'ffff0000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from reactions), 1, 'a player cannot remove someone else''s reaction');

select act_as('ffff0000-0000-0000-0000-000000000002');
delete from reactions where prediction_id = 'ffff0000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from reactions), 0, 'a player removes his own reaction');

select * from finish();
rollback;
