-- pgTAP: « Battez FrenchTrack » (#674). Only the admin posts FrenchTrack's podium, before the
-- lock; the players cannot read it before the lock, even through the API.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(18);

insert into auth.users (id, email) values
  ('f7f70000-0000-0000-0000-000000000001', 'admin-frenchtrack@example.test'),
  ('f7f70000-0000-0000-0000-000000000002', 'bob-frenchtrack@example.test'),
  ('f7f70000-0000-0000-0000-000000000003', 'cleo-frenchtrack@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('f7f70000-0000-0000-0000-000000000001', 'FrenchTrack', now()),
  ('f7f70000-0000-0000-0000-000000000002', 'Bob', now()),
  ('f7f70000-0000-0000-0000-000000000003', 'Cleo', now());
update profiles set is_admin = true where id = 'f7f70000-0000-0000-0000-000000000001';

-- An open event with the athletes of the seed's women's 100 m.
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select 'f7f70000-0000-0000-0000-0000000000e1', c.id, 'test-frenchtrack', '100 m', 'F',
       now() + interval '1 day', now() + interval '1 hour'
from competitions c where c.slug = 'ultimate-championship-2026';
insert into entries (event_id, athlete_id)
select 'f7f70000-0000-0000-0000-0000000000e1', athlete_id from entries
where event_id = (select id from events where slug = 'f-100m');

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
create function athlete(p_index int) returns uuid language sql as $$
  select athlete_id from entries where event_id = 'f7f70000-0000-0000-0000-0000000000e1'
  order by athlete_id offset p_index - 1 limit 1
$$;

set local role authenticated;

-- A player cannot post FrenchTrack's podium.
select act_as('f7f70000-0000-0000-0000-000000000002');
select throws_ok($$ select admin_set_frenchtrack_pick('f7f70000-0000-0000-0000-0000000000e1',
                                                      athlete(1), athlete(2), athlete(3)) $$,
  '42501', null, 'a player cannot post the podium of FrenchTrack');
select throws_ok($$ select * from frenchtrack_picks $$,
  '42501', null, 'a player cannot read the table of FrenchTrack''s podiums');

-- The admin posts it.
select act_as('f7f70000-0000-0000-0000-000000000001');
select lives_ok($$ select admin_set_frenchtrack_pick('f7f70000-0000-0000-0000-0000000000e1',
                                                     athlete(1), athlete(2), athlete(3)) $$,
  'the admin posts the podium of FrenchTrack before the lock');
select is((select p1 from frenchtrack_challenge('f7f70000-0000-0000-0000-0000000000e1')), athlete(1),
  'the admin reads the podium of FrenchTrack before the lock');
select throws_ok($$ select admin_set_frenchtrack_pick('f7f70000-0000-0000-0000-0000000000e1',
                                                      athlete(1), athlete(1), athlete(3)) $$,
  '23514', null, 'the same athlete cannot be on two places');

-- Before the lock, the players know a podium is posted, not which one.
select act_as('f7f70000-0000-0000-0000-000000000002');
select is((select count(*)::int from frenchtrack_challenge('f7f70000-0000-0000-0000-0000000000e1')), 1,
  'a player sees that the event is a challenge');
select ok((select p1 is null and p2 is null and p3 is null and not locked
           from frenchtrack_challenge('f7f70000-0000-0000-0000-0000000000e1')),
  'a player cannot read the podium of FrenchTrack before the lock');
select is((select count(*)::int from frenchtrack_challenges(
             extract(year from (now() + interval '1 day') at time zone 'Europe/Paris')::int)
           where event_id = 'f7f70000-0000-0000-0000-0000000000e1'), 1,
  'the challenge is listed in its season');

-- Bob and Cleo predict, the event locks and is computed.
reset role;
insert into predictions (user_id, event_id, p1, p2, p3) values
  ('f7f70000-0000-0000-0000-000000000002', 'f7f70000-0000-0000-0000-0000000000e1', athlete(1), athlete(2), athlete(3)),
  ('f7f70000-0000-0000-0000-000000000003', 'f7f70000-0000-0000-0000-0000000000e1', athlete(4), athlete(5), athlete(6));
update events set lock_at = now() - interval '1 minute' where id = 'f7f70000-0000-0000-0000-0000000000e1';
set local role authenticated;

select act_as('f7f70000-0000-0000-0000-000000000001');
select throws_ok($$ select admin_set_frenchtrack_pick('f7f70000-0000-0000-0000-0000000000e1',
                                                      athlete(2), athlete(1), athlete(3)) $$,
  'FT034', null, 'the podium of FrenchTrack cannot change once the event is locked');
select throws_ok($$ select admin_remove_frenchtrack_pick('f7f70000-0000-0000-0000-0000000000e1') $$,
  'FT034', null, 'a challenge cannot be removed once the event is locked');
select lives_ok($$ select set_event_scores('f7f70000-0000-0000-0000-0000000000e1', jsonb_build_array(
  jsonb_build_object('user_id', 'f7f70000-0000-0000-0000-000000000002', 'points', 12),
  jsonb_build_object('user_id', 'f7f70000-0000-0000-0000-000000000003', 'points', 0))) $$,
  'the admin computes the points of the players');
select lives_ok($$ select admin_set_frenchtrack_points('f7f70000-0000-0000-0000-0000000000e1', 5) $$,
  'the admin stores the points of FrenchTrack with them');

select act_as('f7f70000-0000-0000-0000-000000000003');
select throws_ok($$ select admin_set_frenchtrack_points('f7f70000-0000-0000-0000-0000000000e1', 99) $$,
  '42501', null, 'a player cannot set the points of FrenchTrack');

select act_as('f7f70000-0000-0000-0000-000000000002');
select is((select p1 from frenchtrack_challenge('f7f70000-0000-0000-0000-0000000000e1')), athlete(1),
  'once locked, a player reads the podium of FrenchTrack');
select is((select row(points, mine, scores)::text
           from frenchtrack_challenge('f7f70000-0000-0000-0000-0000000000e1')), '(5,12,"{0,12}")',
  'once computed, FrenchTrack''s points come with mine and those of every player, without names');
select is((select count(*)::int from frenchtrack_season(
             extract(year from (now() + interval '1 day') at time zone 'Europe/Paris')::int)
           where event_id = 'f7f70000-0000-0000-0000-0000000000e1'), 2,
  'the season counts every player of a computed challenge');

reset role;
set local role anon;
select throws_ok($$ select * from frenchtrack_challenge('f7f70000-0000-0000-0000-0000000000e1') $$,
  '42501', null, 'a visitor cannot read a challenge');

reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok($$ select * from frenchtrack_challenge('f7f70000-0000-0000-0000-0000000000e1') $$,
  '42501', null, 'a caller without identity cannot read a challenge');

select * from finish();
rollback;
