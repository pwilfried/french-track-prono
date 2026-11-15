-- pgTAP: the feed of a league (#671). A member reads the moments of their leagues, someone outside
-- reads nothing; nobody writes them but the admin's publication, which keeps a fact once.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(12);

insert into auth.users (id, email) values
  ('f6710000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('f6710000-0000-0000-0000-000000000002', 'outsider@example.test'),
  ('f6710000-0000-0000-0000-000000000003', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('f6710000-0000-0000-0000-000000000001', 'Chef671', now()),
  ('f6710000-0000-0000-0000-000000000002', 'Dehors671', now()),
  ('f6710000-0000-0000-0000-000000000003', 'Admin671', now());
update profiles set is_admin = true where id = 'f6710000-0000-0000-0000-000000000003';
insert into competitions (slug, name, starts_on, ends_on)
values ('test-moments', 'Test moments', current_date + 10, current_date + 11);
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select id, '100m', '100 m', 'F', now() + interval '10 days', now() + interval '10 days'
from competitions where slug = 'test-moments';

create temp table ctx (league uuid, code text, event uuid);
grant all on ctx to authenticated;

select set_config('request.jwt.claims',
  json_build_object('sub', 'f6710000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into ctx (league, code) select * from create_league('Moments', array['test-moments']);
reset role;
update ctx set event = (select e.id from events e join competitions c on c.id = e.competition_id
                        where c.slug = 'test-moments');

-- A player writes nothing, not even in their own league.
set local role authenticated;
select throws_ok($$
  insert into league_moments (league_id, key, kind, user_id)
  select league, 'perfect_podium:x:y', 'perfect_podium', 'f6710000-0000-0000-0000-000000000001'
  from ctx $$,
  '42501', null, 'a player cannot write a moment directly');
select throws_ok($$ select admin_publish_league_moments((select league from ctx), '[]') $$,
  '42501', null, 'a player cannot publish moments');
select throws_ok($$ select admin_moment_leagues('test-moments') $$,
  '42501', null, 'a player cannot read the leagues to publish in');

-- The admin publishes; the same fact twice is kept once, a non member is left out.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6710000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is(
  (select jsonb_array_length(admin_moment_leagues('test-moments'))), 1,
  'the admin reads the leagues counting the competition');
select is(
  (select admin_publish_league_moments(league, jsonb_build_array(
     jsonb_build_object('key', 'perfect_podium:' || event || ':f6710000-0000-0000-0000-000000000001',
                        'kind', 'perfect_podium', 'user_id', 'f6710000-0000-0000-0000-000000000001',
                        'event_id', event),
     jsonb_build_object('key', 'perfect_podium:' || event || ':f6710000-0000-0000-0000-000000000002',
                        'kind', 'perfect_podium', 'user_id', 'f6710000-0000-0000-0000-000000000002',
                        'event_id', event))) from ctx),
  1, 'the admin publishes a moment of a member, not of someone outside');
select is(
  (select admin_publish_league_moments(league, jsonb_build_array(
     jsonb_build_object('key', 'perfect_podium:' || event || ':f6710000-0000-0000-0000-000000000001',
                        'kind', 'perfect_podium', 'user_id', 'f6710000-0000-0000-0000-000000000001',
                        'event_id', event))) from ctx),
  0, 'publishing the same fact again adds nothing');
select throws_ok($$
  select admin_publish_league_moments((select league from ctx), jsonb_build_array(
    jsonb_build_object('key', 'chat:1', 'kind', 'chat',
                       'user_id', 'f6710000-0000-0000-0000-000000000001'))) $$,
  '23514', null, 'an unknown kind of moment is refused');

-- The member reads the feed of their league, with the competition and the event.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6710000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select results_eq(
  $$ select kind, pseudo, competition_name, discipline from league_feed((select league from ctx)) $$,
  $$ values ('perfect_podium'::text, 'Chef671'::text, 'Test moments'::text, '100 m'::text) $$,
  'a member reads the feed of their league');
select throws_ok($$ update league_moments set kind = 'badge' $$,
  '42501', null, 'a member cannot change a moment');
select throws_ok($$ delete from league_moments $$,
  '42501', null, 'a member cannot delete a moment');

-- Someone outside the league reads nothing.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6710000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*) from league_moments), 0::bigint,
  'someone outside the league reads none of its moments');
select is((select count(*) from league_feed((select league from ctx))), 0::bigint,
  'someone outside the league reads an empty feed');

select * from finish();
rollback;
