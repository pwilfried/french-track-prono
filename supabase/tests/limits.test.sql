-- pgTAP: caps from the security audit of 15 Nov 2026 (#913). A player sends at most 20 reports
-- (leagues and moment reactions) in 24 hours, then FT035; a player keeps at most 10 notification
-- devices, the oldest being replaced. Run with `supabase test db`. Everything is rolled back.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('f9130000-0000-0000-0000-000000000001', 'owner913@example.test'),
  ('f9130000-0000-0000-0000-000000000002', 'reporter913@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('f9130000-0000-0000-0000-000000000001', 'Owner913', now()),
  ('f9130000-0000-0000-0000-000000000002', 'Reporter913', now());

-- 25 public leagues; the reporter is a member of the first, which has a moment and two reactions.
insert into leagues (id, name, owner_id, is_public)
select ('f913eeee-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'Ligue 913 n' || n,
       'f9130000-0000-0000-0000-000000000001', true
from generate_series(1, 25) n;
insert into league_members (league_id, user_id, role) values
  ('f913eeee-0000-0000-0000-000000000001', 'f9130000-0000-0000-0000-000000000001', 'owner'),
  ('f913eeee-0000-0000-0000-000000000001', 'f9130000-0000-0000-0000-000000000002', 'member');
insert into league_moments (league_id, key, kind, user_id) values
  ('f913eeee-0000-0000-0000-000000000001', 'new_leader:e1:owner', 'new_leader',
   'f9130000-0000-0000-0000-000000000001');
insert into moment_reactions (id, league_id, moment_key, user_id, kind, code) values
  ('f913aaaa-0000-0000-0000-000000000001', 'f913eeee-0000-0000-0000-000000000001',
   'new_leader:e1:owner', 'f9130000-0000-0000-0000-000000000001', 'emoji', 'fire'),
  ('f913aaaa-0000-0000-0000-000000000002', 'f913eeee-0000-0000-0000-000000000001',
   'new_leader:e1:owner', 'f9130000-0000-0000-0000-000000000001', 'message', 'rematch');

-- Already sent: one report a day ago (it no longer counts) and 18 in the last hours.
insert into league_reports (league_id, user_id, created_at)
select ('f913eeee-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'f9130000-0000-0000-0000-000000000002',
       case when n = 1 then now() - interval '25 hours' else now() - interval '1 hour' end
from generate_series(1, 19) n;

select set_config('request.jwt.claims',
  json_build_object('sub', 'f9130000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok($$ select report_league('f913eeee-0000-0000-0000-000000000020') $$,
  'the 19th report of the day goes through (one older than 24 hours does not count)');
select lives_ok($$ select report_moment_reaction('f913aaaa-0000-0000-0000-000000000001') $$,
  'the 20th report of the day, on a reaction, goes through');
select throws_ok($$ select report_league('f913eeee-0000-0000-0000-000000000021') $$,
  'FT035', null, 'a 21st league report in 24 hours is refused');
select throws_ok($$ select report_moment_reaction('f913aaaa-0000-0000-0000-000000000002') $$,
  'FT035', null, 'a 21st reaction report in 24 hours is refused');
select lives_ok($$ select report_league('f913eeee-0000-0000-0000-000000000020') $$,
  'reporting again what was already reported still changes nothing');

-- Ten devices already, the oldest first; an eleventh replaces the oldest.
reset role;
insert into push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
select 'https://push.example.test/913-' || n, 'f9130000-0000-0000-0000-000000000002', 'k', 'a',
       now() - (n || ' days')::interval
from generate_series(1, 10) n;
set local role authenticated;

select lives_ok($$ select save_push_subscription('https://push.example.test/913-new', 'k', 'a') $$,
  'an eleventh device is saved');
reset role;
select is((select count(*)::int from push_subscriptions
           where user_id = 'f9130000-0000-0000-0000-000000000002'), 10,
  'a player keeps at most 10 devices');
select is((select count(*)::int from push_subscriptions
           where endpoint = 'https://push.example.test/913-10'), 0,
  'the oldest device is the one replaced');

select * from finish();
rollback;
