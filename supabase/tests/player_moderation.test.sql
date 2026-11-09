-- pgTAP: the admin blocks, unblocks and deletes a player (#343).
begin;
select plan(15);

insert into auth.users (id, email) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'admin-mod@example.test'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'fred@example.test'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'gina@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Admin Mod', now(), true),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Frédo', now(), false),
  ('eeeeeeee-0000-0000-0000-000000000003', 'Gina', now(), false);

-- Fred and Gina share a league and both have points.
insert into leagues (id, name, owner_id) values
  ('eeeeeeee-1111-0000-0000-000000000001', 'Ligue Mod', 'eeeeeeee-0000-0000-0000-000000000003');
insert into league_members (league_id, user_id, role) values
  ('eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003', 'owner'),
  ('eeeeeeee-1111-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002', 'member');
insert into score_events (user_id, competition_id, event_id, source, points, reason)
select u, e.competition_id, e.id, 'prediction', 10, 'prediction'
from (values ('eeeeeeee-0000-0000-0000-000000000002'::uuid), ('eeeeeeee-0000-0000-0000-000000000003'::uuid)) v(u),
     (select id, competition_id from events order by id limit 1) e;

set local role authenticated;

-- A player cannot moderate, nor unblock themselves.
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select * from admin_search_players('gi')$$, '42501', null, 'a player cannot search players');
select throws_ok($$select admin_set_player_blocked('eeeeeeee-0000-0000-0000-000000000003', true)$$,
  '42501', null, 'a player cannot block');
select throws_ok($$update profiles set blocked_at = now() where id = auth.uid()$$,
  '42501', null, 'a player cannot change the blocked flag');

-- The admin finds Fred without the accent, then blocks him.
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select pseudo from admin_search_players('fredo')), 'Frédo', 'search ignores accents and case');
select lives_ok($$select admin_set_player_blocked('eeeeeeee-0000-0000-0000-000000000002', true)$$,
  'the admin blocks a player');
select is((select blocked from admin_search_players('fredo')), true, 'the player shows as blocked');
select is((select payload->>'action' from admin_actions where action = 'moderate_player' order by at desc limit 1),
  'block', 'the block is logged');
select throws_ok($$select admin_set_player_blocked('eeeeeeee-0000-0000-0000-000000000001', true)$$,
  'P0002', null, 'an admin cannot be blocked');

-- Gina no longer sees Fred in the rankings or in her league.
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from score_events where user_id = 'eeeeeeee-0000-0000-0000-000000000002'),
  0, 'a blocked player leaves the rankings');
select is((select count(*)::int from league_members where league_id = 'eeeeeeee-1111-0000-0000-000000000001'),
  1, 'a blocked player leaves the league ranking');

-- Fred himself cannot join a league.
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select create_league('Ligue de Fred', '{}')$$, 'FT014', null,
  'a blocked player creates no league');

-- Unblocked, he is back.
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select admin_set_player_blocked('eeeeeeee-0000-0000-0000-000000000002', false)$$,
  'the admin unblocks');
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from score_events where user_id = 'eeeeeeee-0000-0000-0000-000000000002'),
  1, 'an unblocked player is back in the rankings');

-- The admin deletes Gina's account: her league goes to Fred.
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select admin_delete_player('eeeeeeee-0000-0000-0000-000000000003')$$,
  'the admin deletes a player');
reset role;
select is((select owner_id from leagues where id = 'eeeeeeee-1111-0000-0000-000000000001'),
  'eeeeeeee-0000-0000-0000-000000000002'::uuid, 'her league goes to the oldest other member');

select * from finish();
rollback;
