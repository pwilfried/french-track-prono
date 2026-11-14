-- pgTAP: the consensus of an event (#680). Nothing before the lock, even through the API; a
-- league's consensus is readable by its members only; the podiums come back without any name.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('c0c00000-0000-0000-0000-000000000001', 'anna-consensus@example.test'),
  ('c0c00000-0000-0000-0000-000000000002', 'bob-consensus@example.test'),
  ('c0c00000-0000-0000-0000-000000000003', 'cleo-consensus@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('c0c00000-0000-0000-0000-000000000001', 'Anna', now()),
  ('c0c00000-0000-0000-0000-000000000002', 'Bob', now()),
  ('c0c00000-0000-0000-0000-000000000003', 'Cleo', now());

-- An open event with the athletes of the seed's women's 100 m, predicted by all three.
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select 'c0c00000-0000-0000-0000-0000000000e1', c.id, 'test-consensus', '100 m', 'F',
       now() + interval '1 day', now() + interval '1 hour'
from competitions c where c.slug = 'ultimate-championship-2026';
insert into entries (event_id, athlete_id)
select 'c0c00000-0000-0000-0000-0000000000e1', athlete_id from entries
where event_id = (select id from events where slug = 'f-100m');
insert into predictions (user_id, event_id, p1, p2, p3)
select u.id::uuid, 'c0c00000-0000-0000-0000-0000000000e1', a[u.first], a[u.second], a[3]
from (select array_agg(athlete_id order by athlete_id) a from entries
      where event_id = 'c0c00000-0000-0000-0000-0000000000e1') x,
     (values ('c0c00000-0000-0000-0000-000000000001', 1, 2),
             ('c0c00000-0000-0000-0000-000000000002', 1, 2),
             ('c0c00000-0000-0000-0000-000000000003', 2, 1)) as u(id, first, second);

-- A league of Anna and Bob.
insert into leagues (id, name, owner_id)
values ('c0c00000-0000-0000-0000-0000000000f1', 'Consensus', 'c0c00000-0000-0000-0000-000000000001');
insert into league_members (league_id, user_id, role) values
  ('c0c00000-0000-0000-0000-0000000000f1', 'c0c00000-0000-0000-0000-000000000001', 'owner'),
  ('c0c00000-0000-0000-0000-0000000000f1', 'c0c00000-0000-0000-0000-000000000002', 'member');

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;
select act_as('c0c00000-0000-0000-0000-000000000001');

select throws_ok($$ select * from event_consensus('c0c00000-0000-0000-0000-0000000000e1') $$,
  'FT033', null, 'the consensus of an event that is not locked is refused');
select throws_ok($$ select * from event_consensus('c0c00000-0000-0000-0000-0000000000e1',
                                                  'c0c00000-0000-0000-0000-0000000000f1') $$,
  'FT033', null, 'the league consensus of an event that is not locked is refused too');
select throws_ok($$ select * from event_consensus('c0c00000-0000-0000-0000-0000000000e9') $$,
  'FT033', null, 'an unknown event has no consensus');

-- The event locks.
reset role;
update events set lock_at = now() - interval '1 minute' where id = 'c0c00000-0000-0000-0000-0000000000e1';
set local role authenticated;
select act_as('c0c00000-0000-0000-0000-000000000001');

select is((select count(*)::int from event_consensus('c0c00000-0000-0000-0000-0000000000e1')), 3,
  'once locked, the consensus counts every prediction');
select is((select count(*)::int from event_consensus('c0c00000-0000-0000-0000-0000000000e1') where mine), 1,
  'the caller''s own podium is marked, and only it');
select is((select count(*)::int from event_consensus('c0c00000-0000-0000-0000-0000000000e1',
                                                     'c0c00000-0000-0000-0000-0000000000f1')), 2,
  'the league consensus counts the predictions of its members only');

select act_as('c0c00000-0000-0000-0000-000000000003');
select throws_ok($$ select * from event_consensus('c0c00000-0000-0000-0000-0000000000e1',
                                                  'c0c00000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'a player outside the league cannot read its consensus');

reset role;
set local role anon;
select throws_ok($$ select * from event_consensus('c0c00000-0000-0000-0000-0000000000e1') $$,
  '42501', null, 'a visitor cannot read the consensus');

reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select * from event_consensus('c0c00000-0000-0000-0000-0000000000e1') $$,
  '42501', null, 'a caller without identity cannot read the consensus');

select * from finish();
rollback;
